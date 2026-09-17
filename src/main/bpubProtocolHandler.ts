import { app, net } from "electron";
import * as fs from "fs";
import * as Path from "path";
import { getPathToResourceFromAnotherBook } from "./linkedBookLoader";

// Note I'm not sure we actually need this "bpub://" protocol, but it's how
// we originally set things up. I suspect we could just be using "http://localhost:xxxx"

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

  console.log("bpub protocol request: " + request.url);

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
    const response = await net.fetch(`file:///${filePath}`);
    return response;
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

function convertUrlToPath(
  requestUrl: string,
  currentUnpackedBookFolder: string,
): string {
  const urlPrefix = "bpub://";
  const bloomPlayerOrigin = urlPrefix + "bloom-player/";
  const baseUrl = decodeURIComponent(requestUrl);
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
  else if (urlPath.startsWith("bloomplayer.htm?allowToggleAppBar")) {
    path = Path.join(playerFolder, "bloomplayer.htm");
  } else if (!urlPath.includes("/")) {
    path = Path.join(playerFolder, urlPath);
  } else if (urlPath.includes("?")) {
    path = Path.normalize(urlPath.substr(0, urlPath.indexOf("?")));
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
