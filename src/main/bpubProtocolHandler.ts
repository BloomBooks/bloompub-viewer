import { app, net } from "electron";
import * as fs from "fs";
import * as Path from "path";
import { getPathToResourceFromAnotherBook } from "./linkedBookLoader";

// Note I'm not sure we actually need this "bpub://" protocol, but it's how
// we originally set things up. I suspect we could just be using "http://localhost:xxxx"

export async function bpubProtocolHandler(
  request: Request,
  currentPrimaryBloomPubPath: string,
  currentUnpackedBookFolder: string // enhance probably we could look this up if we start remembering what is unpacked and where
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
      parentFolder
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
  }

  try {
    console.log("Sending file: " + filePath);
    const response = await net.fetch(`file:///${filePath}`);
    return response;
  } catch (error) {
    console.error(
      `Error handling bpub request for ${request.url} which lead to ${filePath}, got ${error}`
    );
    return new Response("Error", {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
}

function convertUrlToPath(
  requestUrl: string,
  currentUnpackedBookFolder: string
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
          Path.join(app.getAppPath(), "../../node_modules/bloom-player/dist")
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

// Starting in bloom-player 2.1, we have font-face rules which tell the host to serve up
// the appropriate Andika or Andika New Basic font file. An example is:
//             @font-face {
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
// So if we have a request for /host/fonts/, here is where we intercept and handle it.
function getPathToFont(fontRequested: string) {
  let fontFileName = fontRequested;
  switch (fontRequested) {
    case "Andika New Basic":
    case "Andika":
      fontFileName = "Andika-Regular.ttf";
      break;
    case "Andika New Basic Bold":
    case "Andika Bold":
      fontFileName = "Andika-Bold.ttf";
      break;
    case "Andika New Basic Italic":
    case "Andika Italic":
      fontFileName = "Andika-Italic.ttf";
      break;
    case "Andika New Basic Bold Italic":
    case "Andika Bold Italic":
      fontFileName = "Andika-BoldItalic.ttf";
      break;
  }
  return Path.normalize(
    Path.join(app.getAppPath(), "../../static/fonts/", fontFileName)
  );
}
