import { app, BrowserWindow, ipcMain, protocol } from "electron";
import * as fs from "fs";
import * as unzipper from "unzipper";
import * as temp from "temp";
import * as Path from "path";

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== "development") {
  global.__static = require("path")
    .join(__dirname, "/static")
    .replace(/\\/g, "\\\\");
}

// Register our internal scheme ("bpub") as standard.  A standard scheme adheres to what is
// called "generic URI syntax".  A standard scheme can resolve both relative and absolute
// resources correctly when served.  Also register our internal scheme to bypass content
// security policy for resources.
protocol.registerSchemesAsPrivileged([
  { scheme: "bpub", privileges: { standard: true, bypassCSP: true } },
]);

let mainWindow: BrowserWindow | null;

// Automatically track and remove temp folders of unzipped files at exit.
temp.track();

const winURL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:9080"
    : `file://${__dirname}/index.html`;

const preloadPath =
  process.env.NODE_ENV === "development"
    ? Path.join(app.getAppPath(), "preload.js")
    : Path.join(__dirname, "preload.js");

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    height: 563,
    useContentSize: true,
    width: 1000,
    fullscreenable: true,
    webPreferences: {
      nodeIntegration: false,
      webSecurity: true,
      contextIsolation: true,
      preload: preloadPath,
    },
    //windows
    icon: Path.join(__dirname, "../../assets/windows.ico"),
    title: "BloomPUB Viewer " + require("../../package.json").version,
  });

  mainWindow.loadURL(winURL);

  /* This is still in progress, held up while we decide if we can put the necessary certificate in github
    secrets. Without that, we can't sign, and without signing, we can' auto update anyways.
    setupAutoUpdate();*/

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

let currentFolder: string;

function convertUrlToPath(requestUrl: string): string {
  // console.log(`convertUrlToPath: requestUrl=${requestUrl}`);

  const bloomPlayerOrigin = "bpub://bloom-player/";
  const baseUrl = decodeURI(requestUrl);
  const urlPath = baseUrl.startsWith(bloomPlayerOrigin)
    ? baseUrl.substr(bloomPlayerOrigin.length)
    : baseUrl.substr(7); // not from same origin? shouldn't happen.
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
    path = Path.normalize(Path.join(currentFolder, path));
  }

  // If a subfile (image, video, activity) is stored with a '+' in the name, it will arrive
  // here as "%2b". We need to convert it back to '+'.
  path = path.replace(/%2b/gi, "+");

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

app.whenReady().then(() => {
  protocol.registerFileProtocol("bpub", (request, callback) => {
    callback(convertUrlToPath(request.url));
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on("toggleFullScreen", (event) => {
  const makeFullScreen = !mainWindow!.isFullScreen();
  mainWindow!.setMenuBarVisibility(!makeFullScreen);
  mainWindow!.setFullScreen(makeFullScreen);
  event.returnValue = makeFullScreen;
});
ipcMain.on("toggleDevTools", (event) => {
  mainWindow!.webContents.toggleDevTools();
});

ipcMain.on("exitFullScreen", () => {
  mainWindow!.setMenuBarVisibility(true);
  mainWindow!.setFullScreen(false);
});

ipcMain.on("get-file-that-launched-me", (event, arg) => {
  // using app.isPackaged because the 2nd argument is a javascript path in dev mode
  if (app.isPackaged && process.argv.length >= 2) {
    console.log(JSON.stringify(process.argv));
    var openFilePath = process.argv[1];
    event.returnValue = openFilePath;
  } else {
    event.returnValue = ""; //"D:\\temp\\The Moon and the Cap.bloomd";
  }
});

ipcMain.on("unpack-zip-file", (event, zipFilePath) => {
  const slashIndex = zipFilePath.replace(/\\/g, "/").lastIndexOf("/");
  const unpackedFolder = temp.mkdirSync("bloomPUB-viewer-");
  currentFolder = unpackedFolder; // remember for bpub protocol if needed.
  const stream = fs.createReadStream(zipFilePath);
  // This will wait until we know the readable stream is actually valid before piping
  stream.on("open", () => {
    stream.pipe(
      unzipper
        .Extract({ path: unpackedFolder })
        // unzipper calls this when it's done unzipping
        .on("close", () => {
          let filename = "index.htm";
          if (!fs.existsSync(Path.join(unpackedFolder, filename))) {
            // it must be the old method, where we named the htm the same as the bloomd (which was obviously fragile):
            const bookTitle = zipFilePath.substring(
              slashIndex + 1,
              zipFilePath.length
            );
            filename = bookTitle
              .replace(/\.bloomd/gi, ".htm")
              .replace(/\.bloompub/gi, ".htm");
            if (!fs.existsSync(Path.join(unpackedFolder, filename))) {
              // maybe it's the old format AND the user changed the name
              filename =
                fs
                  .readdirSync(unpackedFolder)
                  .find((f) => Path.extname(f) === ".htm") ||
                "no htm file found";
            }
          }
          event.reply(
            "zip-file-unpacked",
            zipFilePath,
            Path.join(unpackedFolder, filename).replace(/\\/g, "/")
          );
        })
    );
  });
});

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'
autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})
app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
