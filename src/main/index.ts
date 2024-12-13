import { app, BrowserWindow, ipcMain, protocol } from "electron";
import * as temp from "temp";
import * as Path from "path";
import { bpubProtocolHandler } from "./bpubProtocolHandler";
import { unpackBloomPub } from "./bloomPubUnpacker";

// Global exception handlers
process.on("uncaughtException", (error) => {
  if (mainWindow) {
    mainWindow.webContents.send("uncaught-error", error.message);
  }
});
process.on("unhandledRejection", (reason, promise) => {
  if (mainWindow) {
    mainWindow.webContents.send("uncaught-error", reason);
  }
});

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
// security policy for resources.  The scheme also needs to be registered as supporting
// streaming.  Without this, the fetch can fail when the resource is larger than 32K.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "bpub",
    privileges: { standard: true, bypassCSP: true, stream: true },
  },
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

  require("@electron/remote/main").enable(mainWindow.webContents);
  require("@electron/remote/main").initialize();

  mainWindow.loadURL(winURL);

  /* This is still in progress, held up while we decide if we can put the necessary certificate in github
    secrets. Without that, we can't sign, and without signing, we can' auto update anyways.
    setupAutoUpdate();*/

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.whenReady().then(() => {
  protocol.handle("bpub", (request: GlobalRequest) =>
    bpubProtocolHandler(
      request,
      currentPrimaryBloomPubPath,
      currentPrimaryBookUnpackedFolder
    )
  );
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

let currentPrimaryBloomPubPath: string;
let currentPrimaryBookUnpackedFolder: string;

// "primary" here is used because books can link to other books, but
// we still have a notion of the book you opened directly from this component.
ipcMain.on("switch-primary-book", async (event, zipFilePath) => {
  const result = await unpackBloomPub(zipFilePath);
  currentPrimaryBloomPubPath = zipFilePath;
  currentPrimaryBookUnpackedFolder = result.unpackedToFolderPath;
  event.reply("bloomPub-ready", result.zipPath, result.htmPath);
  // if there's an exception in the above, we'll just let it bubble up to
  // the global exception handler
});
