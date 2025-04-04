import { contextBridge, ipcRenderer } from "electron";
import * as remote from "@electron/remote";

// Expose protected methods that allow the renderer process to use
// ipcRenderer, remote, and shell without exposing the entire objects
contextBridge.exposeInMainWorld("bloomPubViewMainApi", {
  sendSync: (channel: string, data) => {
    // whitelist channels
    let validChannels = ["get-file-that-launched-me", "toggleFullScreen"];
    if (validChannels.includes(channel)) {
      return ipcRenderer.sendSync(channel, data);
    }
  },
  send: (channel: string, data) => {
    // whitelist channels
    let validChannels = [
      "switch-primary-book",
      "switch-primary-book-failed",
      "exitFullScreen",
      "toggleDevTools",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel: string, func) => {
    let validChannels = [
      "book-ready-to-display",
      "uncaught-error",
      "switch-primary-book-failed",
      "open-file",
    ];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  openSIL: () => {
    remote.shell.openExternal("https://sil.org");
  },
  openLibrary: () => {
    remote.shell.openExternal("https://bloomlibrary.org");
  },
  openDownloadPage: (downloadLink: string) => {
    if (downloadLink.startsWith("https://bloomlibrary.org")) {
      remote.shell.openExternal(downloadLink);
    }
  },

  addRecentDocument: (bloomPubPath: string) => {
    remote.app.addRecentDocument(bloomPubPath);
  },

  quit: () => {
    remote.app.quit();
  },

  setApplicationMenu: (template: Array<any>) => {
    const menu = remote.Menu.buildFromTemplate(
      template as Electron.MenuItemConstructorOptions[]
    );
    remote.Menu.setApplicationMenu(menu);
  },

  showOpenDialog: (options, func) => {
    remote.dialog
      .showOpenDialog(options as Electron.OpenDialogOptions)
      .then((result) => {
        if (!result.canceled && result.filePaths.length > 0) {
          func(result.filePaths[0]);
        } else {
          func("");
        }
      });
  },

  getCurrentAppVersion: () => {
    return require("../package.json").version;
  },

  getRecentBooks: () => {
    return ipcRenderer.sendSync("get-recent-books");
  },

  // addRecentBook: (book) => {
  //   ipcRenderer.send("add-recent-book", book);
  // },
});
