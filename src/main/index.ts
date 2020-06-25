import { app, BrowserWindow, ipcMain } from "electron";
import * as Path from "path";
import { setupAutoUpdate } from "./autoUpdate";

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== "development") {
  global.__static = require("path")
    .join(__dirname, "/static")
    .replace(/\\/g, "\\\\");
}

let mainWindow: BrowserWindow | null;

const winURL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:9080"
    : `file://${__dirname}/index.html`;

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    height: 563,
    useContentSize: true,
    width: 1000,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
    },
    //windows
    icon: Path.join(__dirname, "../../build/windows.ico"),
  });

  mainWindow.loadURL(winURL);

  if (process.env.NODE_ENV === "development") {
    console.log(
      "*****If you hang when doing a 'yarn dev', it's possible that Chrome is trying to pause on a breakpoint. Disable the mainWindow.openDevTools(), run 'dev' again, open devtools (ctrl+alt+i), turn off the breakpoint settings, then renable."
    );

    mainWindow.webContents.openDevTools();
  }

  setupAutoUpdate();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

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
