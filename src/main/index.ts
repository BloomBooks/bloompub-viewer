import { app, BrowserWindow, ipcMain, protocol, shell } from "electron";
import * as temp from "temp";
import * as Path from "path";
import * as fs from "fs";
import { bpubProtocolHandler } from "./bpubProtocolHandler";
import { unpackBloomPub } from "./bloomPubUnpacker";
import windowStateKeeper from "electron-window-state";
import { hasValidExtension } from "../common/extensions";
import * as remoteMain from "@electron/remote/main";
import packageJson from "../../package.json";

//Create log file in temp directory
const logPath = temp.path() + "-bloompubviewer.log";
fs.appendFileSync(
  logPath,
  `\n[${new Date().toISOString()}] App Start
Packaged: ${app.isPackaged}
Command line arguments: ${JSON.stringify(process.argv)}\n`
);

let currentPrimaryBloomPubPath: string | undefined;
let currentPrimaryBookUnpackedFolder: string | undefined;
let launchFile: string | undefined;

// Global exception handlers.
//
// Both of these must send *text* on the "uncaught-error" channel, for two reasons.
// The renderer tags the error toast with this value so a repeated error shows only
// once, and react-toastify ignores a tag that isn't a string or number -- so
// sending an object silently defeated that de-duplication. Worse, react-toastify
// drops a toast whose content isn't a string, number, function or element outright,
// so a non-string here means the user gets torn back to the start screen with no
// message at all. Node hands us the thrown value verbatim, so neither `error.message`
// nor `reason` can be assumed to be a string however they are typed.
process.on("uncaughtException", (error) => {
  if (mainWindow) {
    mainWindow.webContents.send("uncaught-error", `${error?.message ?? error}`);
  }
});
process.on("unhandledRejection", (reason) => {
  if (mainWindow) {
    mainWindow.webContents.send("uncaught-error", `${reason}`);
  }
});

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== "development") {
  global.__static = Path.join(__dirname, "/static").replace(/\\/g, "\\\\");
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

// electron-vite sets ELECTRON_RENDERER_URL while serving; when it is absent we are
// running a built app and load the index.html that sits beside main.js.
const devServerUrl = process.env.ELECTRON_RENDERER_URL;

// main.js and preload.js are emitted side by side into dist/electron in both dev
// and production, so one path works for both. (loadFile below is likewise used in
// place of building a "file://" string, which mishandled paths containing spaces.)
const preloadPath = Path.join(__dirname, "preload.js");

function createWindow() {
  // Load the previous state with fallback to defaults
  const mainWindowState = windowStateKeeper({
    file: "bloompub-viewer-window-state.json",
    // These will only apply when there's no saved state
    defaultWidth: 1300,
    defaultHeight: 800,
    maximize: true,
  });

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    fullscreenable: true,
    webPreferences: {
      nodeIntegration: false,
      webSecurity: true,
      contextIsolation: true,
      preload: preloadPath,
    },
    //windows
    icon: Path.join(__dirname, "../../assets/windows.ico"),
    title: "BloomPUB Viewer " + packageJson.version,
  });

  mainWindowState.manage(mainWindow);

  // Statically imported (see the top of the file) rather than require()d here.
  // These used to be lazy require()s, which webpack happened to bundle; Vite leaves
  // a bare require() alone, so it would have survived into main.js and thrown at
  // startup in a packaged build, where there is no node_modules to resolve it from.
  remoteMain.enable(mainWindow.webContents);
  // enable() is per-webContents, but initialize() is process-wide and throws
  // "@electron/remote has already been initialized" if called twice. createWindow()
  // runs again on macOS when the window is closed and the app is reactivated from
  // the Dock, which would otherwise crash here and leave the window unable to reopen.
  if (!remoteMain.isInitialized()) {
    remoteMain.initialize();
  }

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(Path.join(__dirname, "index.html"));
  }
  mainWindow.setBounds(mainWindowState); // see https://github.com/mawie81/electron-window-state/issues/80

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // The following two event handlers prevent the app from opening external
  // links in another electron window. Instead, they will open in the user's
  // default browser. (BL-13803)
  // I have no idea why the first handler is necessary to make the second one
  // work as I would expect.  But it is.
  mainWindow.webContents.on("will-frame-navigate", (event) => {
    // Let the bpub: protocol handler do its thing.  Any other protocols will also
    // be allowed to proceed.
    if (event.url.startsWith("https://") || event.url.startsWith("http://")) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.on("ready", createWindow);

app.whenReady().then(() => {
  protocol.handle("bpub", (request: GlobalRequest) =>
    bpubProtocolHandler(
      request,
      currentPrimaryBloomPubPath!,
      currentPrimaryBookUnpackedFolder!
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
ipcMain.on("toggleDevTools", () => {
  mainWindow!.webContents.toggleDevTools();
});

ipcMain.on("exitFullScreen", () => {
  mainWindow!.setMenuBarVisibility(true);
  mainWindow!.setFullScreen(false);
});

// On MacOS, handle cases where
// 1) the app is launched with a file
// 2) when the OS subsequently asks us to open a file.
// At the moment on Windows, we handle (1) via the command line args, but have no equivalent to (2).
app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (hasValidExtension(filePath)) {
    if (mainWindow) {
      // TODO: not clear how the timing will work out, haven't tried it.
      // It could be that we get this message too soon, before the renderer is ready to receive it.
      mainWindow.webContents.send("open-file", filePath);
    } else {
      launchFile = filePath;
    }
  }
});

ipcMain.on("get-file-that-launched-me", (event) => {
  // from a mac, we may have been given an event with the file to open
  if (launchFile) {
    event.returnValue = launchFile;
    return;
  }
  // If we're running from the `dev` script, the path will be the 3rd argument.
  launchFile = process.argv[app.isPackaged ? 1 : 2];
  event.returnValue = launchFile;
});

// "primary" here is used because books can link to other books, but
// we still have a notion of the book you opened directly from this component.
ipcMain.on("switch-primary-book", async (event, bloomPubPath) => {
  const result = await unpackBloomPub(bloomPubPath);
  if (result.unpackedToFolderPath === undefined) {
    console.error("Failed to unpack book: " + bloomPubPath);
    currentPrimaryBloomPubPath = undefined;
    currentPrimaryBookUnpackedFolder = undefined;
    let reason = "Unknown reason";
    // if the bloompub doesn't exist, set the reason
    if (!fs.existsSync(bloomPubPath)) {
      reason = "Could not find the book";
    }
    event.reply("switch-primary-book-failed", bloomPubPath, reason);
  } else {
    currentPrimaryBloomPubPath = bloomPubPath;
    currentPrimaryBookUnpackedFolder = result.unpackedToFolderPath;
    event.reply("book-ready-to-display", result.bloomPubPath, result.htmPath);
  }
  // if there's an exception in the above, we'll just let it bubble up to
  // the global exception handler
});
