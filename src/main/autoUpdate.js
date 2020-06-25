// all of this if from https://github.com/iffy/electron-updater-example/blob/master/main.js

const {
  app,
  BrowserWindow,
  Menu,
  protocol,
  ipcMain,
  dialog,
  Notification,
} = require("electron");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");

export function setupAutoUpdate() {
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = "info";
  //log.info("App starting...");

  function autoUpdateStatus(text) {
    dialog.showMessageBoxSync({ title: "Auto Updater", message: text });
    //log.info(text);
    //win.webContents.send("message", text);
    console.log(text);
    console.info("*************" + text);
  }

  autoUpdater.on("checking-for-update", () => {
    autoUpdateStatus("Checking for update...");
  });
  autoUpdater.on("update-available", (info) => {
    autoUpdateStatus("Update available.");
  });
  autoUpdater.on("update-not-available", (info) => {
    autoUpdateStatus("Update not available.");
  });
  autoUpdater.on("error", (err) => {
    autoUpdateStatus("Error in auto-updater. " + err);
  });
  autoUpdater.on("download-progress", (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + " - Downloaded " + progressObj.percent + "%";
    log_message =
      log_message +
      " (" +
      progressObj.transferred +
      "/" +
      progressObj.total +
      ")";
    autoUpdateStatus(log_message);
  });
  autoUpdater.on("update-downloaded", (info) => {
    autoUpdateStatus("Update downloaded");
  });

  dialog.showMessageBoxSync({ message: "Will check for update" });
  // oddly, this will work even if running from debugger: autoUpdater.checkForUpdates();
  // but this will not:
  autoUpdater.checkForUpdatesAndNotify();
}
