import { app } from "electron";
import * as fs from "fs";
import * as Path from "path";
import { Readable } from "stream";
import {
  decodeUriComponentSafely,
  getPathToResourceFromAnotherBook,
} from "./linkedBookLoader";

// bloom-player and the books it shows are delivered to the renderer over our own
// "bpub://" scheme, registered with protocol.handle in index.ts. That choice has a cost
// worth understanding before touching this file.
//
// Chromium has two ways of loading a resource. For file:// URLs it uses its own file
// loader, which knows how to seek inside a local file, so <video src="file:///..."> just
// works. For every other scheme, including any custom one, it behaves as if it were
// talking to an HTTP server and expects that server to speak HTTP: honor the Range
// header, answer 206 with Content-Range, supply a content type. By registering bpub://
// we volunteered to be that server. Electron's protocol.handle gives us only the
// Request/Response plumbing; the HTTP semantics are ours to provide. That is what
// serveFile below does. Electron's maintainers say the same: see
// https://github.com/electron/electron/issues/38749 (Range ignored via net.fetch),
// https://github.com/electron/electron/issues/47661 (their reference implementation,
// which parses Range by hand exactly as we do), and
// https://github.com/electron/electron/issues/51442 ("net.fetch would try to return the
// whole file in one go", closed as not-a-bug).
//
// The alternative is to stop being a custom scheme. Branch BL-16713-local-http-server
// serves the same URL layout from a real HTTP server on 127.0.0.1 (random port, random
// path token) through the `send` library, which handles ranges, content types and 404s
// for us; the code we own comes out about the same size, and it adds a dependency and
// an open loopback port. It works and is kept for reference; this branch was preferred
// as the smaller change. Loading everything over file:// directly would be smaller
// still, but bloom-player fetches book files over XHR and Chromium restricts that on
// file:// origins, so it would need player changes.

export async function bpubProtocolHandler(
  request: Request,
  currentPrimaryBloomPubPath: string,
  currentUnpackedBookFolder: string, // enhance probably we could look this up if we start remembering what is unpacked and where
) {
  // Ignore certain file types.
  // Note, at one point, this was also capturing .woff and .woff2 requests,
  // but that was causing embedded fonts to not load correctly (BL-15789).
  // Since we couldn't determine why they had been included here, we removed them.
  if (request.url.endsWith(".map")) {
    return new Response("Not Found", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const rangeHeader = request.headers.get("Range");
  console.log(
    "bpub protocol request: " +
      request.url +
      (rangeHeader ? ` [${rangeHeader}]` : ""),
  );

  let filePath = "";

  // Handle requests for material in a book other than the one we started with,
  // as happens when you link to another book.
  if (request.url.includes("/book/")) {
    const parentFolder = Path.dirname(currentPrimaryBloomPubPath);
    const result = await getPathToResourceFromAnotherBook(
      request,
      // currently we only search in the same folder as the primary book
      parentFolder,
    );
    if (result) {
      filePath = result;
    } else {
      return new Response("Not Found", {
        status: 404,
        statusText: "Not Found",
      });
    }
  } else {
    filePath = convertUrlToPath(request.url, currentUnpackedBookFolder);

    // Fonts are the one resource we serve out of our own installation rather than out
    // of the book, so return a clean 404 when we can't, rather than letting net.fetch
    // fail and reporting a server error.
    if (request.url.includes("/host/fonts/") && !fs.existsSync(filePath)) {
      if (shippedFontFiles.includes(Path.basename(filePath))) {
        // We're supposed to have this one, so our packaging or path logic is broken.
        // Complain loudly: this stayed hidden for years (BL-16708) because a machine
        // with Andika installed, or simply online, never notices.
        console.error(
          `Could not find the font file we ship for ${request.url}; looked for ${filePath}`,
        );
      } else {
        // Ordinary: the book asked for a font we don't have. It will fall back.
        console.log(`We do not have a font for ${request.url}`);
      }
      return new Response("Not Found", {
        status: 404,
        statusText: "Not Found",
      });
    }
  }

  try {
    console.log("Sending file: " + filePath);
    return await serveFile(filePath, request);
  } catch (error) {
    console.error(
      `Error handling bpub request for ${request.url} which lead to ${filePath}, got ${error}`,
    );
    return new Response("Error", {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
}

// Serve a file from disk, honoring HTTP Range requests.
//
// We used to hand every request to net.fetch("file:///..."), but Electron's file loader
// ignores the Range header and always answers 200 with the whole file
// (https://github.com/electron/electron/issues/38749). That is fine for CSS and images,
// but not for <video> and <audio>: Chromium asks for byte ranges to reach the MP4 index
// (which Bloom's videos keep at the end of the file), to seek, and to resume. Getting the
// whole file back every time made every video non-seekable, downloaded each one two or
// three times per page, and, since Electron 43 (Chromium 150), produced corrupted frames
// and freezes in sign-language books (BL-16713). Answering 206 with exactly the bytes
// asked for fixes all of that.
//
// Tried and rejected: forwarding the Range header into net.fetch. Electron's file loader
// does slice the body then, but still reports status 200 with no Content-Range, so
// Chromium would take the slice for the start of the file, which is a worse version of
// the same bug. We would still have to stat the file and build the 206 headers ourselves,
// so the only thing net.fetch could save us is the content-type table below.
export async function serveFile(
  filePath: string,
  request: Request,
): Promise<Response> {
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return new Response("Not Found", { status: 404, statusText: "Not Found" });
  }
  if (!stat.isFile()) {
    return new Response("Not Found", { status: 404, statusText: "Not Found" });
  }

  const size = stat.size;
  const headers: Record<string, string> = {
    "Content-Type": getContentType(filePath),
    "Accept-Ranges": "bytes",
  };

  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = parseRangeHeader(request.headers.get("Range"), size);
  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: { "Content-Range": `bytes */${size}` },
    });
  }
  if (range) {
    start = range.start;
    end = range.end;
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(size === 0 ? 0 : end - start + 1);

  if (request.method === "HEAD" || size === 0) {
    return new Response(null, { status, headers });
  }

  const nodeStream = fs.createReadStream(filePath, { start, end });
  // Chromium opens open-ended ranges ("bytes=0-") for media and abandons them as soon
  // as it has what it needs. Cancelling the web stream destroys the node stream, but
  // also listen for the request being aborted so the file handle is released either way.
  request.signal?.addEventListener("abort", () => nodeStream.destroy());
  const body = Readable.toWeb(nodeStream) as ReadableStream;
  return new Response(body, { status, headers });
}

// Parses a single-range "bytes=a-b" | "bytes=a-" | "bytes=-n" header.
// Returns undefined when there is no usable Range (serve the whole file), or
// "unsatisfiable" when the range lies entirely beyond the end of the file.
// A multi-range request is treated as no range, which the spec allows.
export function parseRangeHeader(
  header: string | null,
  size: number,
): { start: number; end: number } | "unsatisfiable" | undefined {
  if (!header) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return undefined;
  const [, startText, endText] = match;
  if (startText === "" && endText === "") return undefined;

  let start: number;
  let end: number;
  if (startText === "") {
    // suffix range: the last n bytes
    const suffixLength = Number(endText);
    if (suffixLength === 0) return "unsatisfiable";
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText === "" ? size - 1 : Math.min(Number(endText), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

const contentTypes: Record<string, string> = {
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
  ".wasm": "application/wasm",
};

export function getContentType(filePath: string): string {
  return (
    contentTypes[Path.extname(filePath).toLowerCase()] ??
    "application/octet-stream"
  );
}


function convertUrlToPath(
  requestUrl: string,
  currentUnpackedBookFolder: string,
): string {
  const urlPrefix = "bpub://";
  const bloomPlayerOrigin = urlPrefix + "bloom-player/";
  // Drop any query or fragment before decoding, as a file:// load would; a "?nocache=..."
  // or "?allowToggleAppBar" is not part of the file name. (A literal "?" inside a name
  // arrives percent-encoded and so survives the decoding that follows.)
  const baseUrl = decodeUriComponentSafely(requestUrl.replace(/[?#].*$/, ""));
  const urlPath = baseUrl.startsWith(bloomPlayerOrigin)
    ? baseUrl.substring(bloomPlayerOrigin.length)
    : baseUrl.substring(urlPrefix.length); // not from same origin? shouldn't happen.
  const playerFolder =
    process.env.NODE_ENV === "development"
      ? Path.normalize(
          Path.join(app.getAppPath(), "../../node_modules/bloom-player/dist"),
        )
      : __dirname;
  let path: string;

  if (urlPath.startsWith("host/fonts/"))
    path = getPathToFont(urlPath.substring("host/fonts/".length));
  else if (!urlPath.includes("/")) {
    // A bare file name is one of bloom-player's own files (e.g. bloomplayer.htm).
    path = Path.join(playerFolder, urlPath);
  } else {
    path = Path.normalize(urlPath);
  }
  // It may be a bug in electron, but some books can send out image paths as
  // bare filenames.  (This may happen only on pages with both a picture and
  // a video.  That's the context where I saw this behavior.)
  if (!Path.isAbsolute(path)) {
    path = Path.normalize(Path.join(currentUnpackedBookFolder, path));
  }

  // see if this file exists, and if not console.log it.
  if (!fs.existsSync(path)) {
    console.log(`convertUrlToPath: requested file does not exist: ${path}`);
  }

  // console.log(`convertUrlToPath: path=${path}`);
  return path;
}

// The font files we ship in static/fonts.  Only these files; anything else a book asks
// for has to come from the book itself or from the web.  The list of files matches those
// that Bloom Desktop ships and assumes are available for published books.
export const shippedFontFiles = [
  "Andika-Regular.woff2",
  "Andika-Bold.woff2",
  "Andika-Italic.woff2",
  "Andika-BoldItalic.woff2",
  "ABeeZee-Regular.woff2",
  "ABeeZee-Italic.woff2",
];

// Books and bloom-player both use "./host/fonts/..." to ask us, the host, for a font.
// There are two spellings, and we see both.
//
// 1) By file name.  This is what current versions of Bloom write into the book's
//    defaultLangStyles.css, and it is the one that matters most, because these rules
//    have no local() or https:// fallback at all -- if we don't serve the file, the
//    book simply renders in some other font:
//            @font-face { font-family: Andika; font-weight: bold;
//                         src: url(./host/fonts/Andika-Bold.woff2); }
//    Such a request needs no translation; the name after "host/fonts/" is the file we
//    look for, which is why the names in shippedFontFiles must match what Bloom writes.
//
// 2) By font name, with no extension.  This is the older form, still emitted by
//    bloom-player itself (and by books, for the retired "Andika New Basic" family):
//            @font-face {
//                font-family: "Andika New Basic";
//                font-weight: bold;
//                font-style: normal;
//                src:
//                    local("Andika New Basic Bold"),
//                    local("Andika Bold"),
//    ===>            url("./host/fonts/Andika New Basic Bold"),
//                    url("https://bloomlibrary.org/fonts/Andika%20New%20Basic/AndikaNewBasic-B.woff")
//                ;
//            }
//    The switch below maps those names onto the files we actually have.  (Andika New
//    Basic was superseded by Andika, so we serve Andika for both.)
function getPathToFont(fontRequested: string) {
  let fontFileName = fontRequested;
  switch (fontRequested) {
    case "Andika New Basic":
    case "Andika":
      fontFileName = "Andika-Regular.woff2";
      break;
    case "Andika New Basic Bold":
    case "Andika Bold":
      fontFileName = "Andika-Bold.woff2";
      break;
    case "Andika New Basic Italic":
    case "Andika Italic":
      fontFileName = "Andika-Italic.woff2";
      break;
    case "Andika New Basic Bold Italic":
    case "Andika Bold Italic":
      fontFileName = "Andika-BoldItalic.woff2";
      break;
  }
  // Only ever serve a file we actually ship.  The name arrives percent-decoded, so
  // without this a request for "host/fonts/..%2F..%2Fsomething" would walk out of
  // static/fonts and serve an arbitrary local file.  Anything not on the list we
  // would not have anyway, so pinning it to a bare file name costs no functionality
  // and the caller still reports the miss. (Raised by Devin on PR #63.)
  if (!shippedFontFiles.includes(fontFileName)) {
    fontFileName = Path.basename(fontFileName);
  }
  return Path.join(getFontsFolder(), fontFileName);
}

// Where the Andika files we ship actually live, which differs between running from
// the source tree and running from an installed build.
// In development, dev-runner launches electron with dist/electron/main.js, so
// app.getAppPath() is <repo>/dist/electron and static/ is two levels up, in the source
// tree. (This is the same trick used above to find the bloom-player folder.)
// In a packaged build, webpack.renderer.config.js copies static/ into dist/electron/,
// which is __dirname, and electron-builder packs dist/electron/** into the asar.
// Using app.getAppPath() there would point outside the package entirely (BL-16708).
function getFontsFolder() {
  return process.env.NODE_ENV === "development"
    ? Path.normalize(Path.join(app.getAppPath(), "../../static/fonts"))
    : Path.join(__dirname, "static", "fonts");
}
