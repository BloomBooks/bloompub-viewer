// NOTE: this script runs sandboxed (see sandbox: true in createWindow), so Node's built-in
// modules are NOT available here — only a small subset: electron, events, timers, url.
// Importing something like "path" throws "module not found" and takes the whole preload down
// with it, which leaves the renderer with no bloomPubViewMainApi at all and no obvious clue
// why. Anything needing Node belongs in the main process instead. (The require of
// package.json below is fine: webpack inlines the JSON at build time.)
import { contextBridge, ipcRenderer, webUtils } from "electron";
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

  // Electron 32 removed the File.path property that drag-and-drop used to rely on.
  // webUtils.getPathForFile() is the replacement, and it is only available here in
  // the preload, so the renderer has to ask us.
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // Where the Open dialog should start. Main works this out, because it owns the
  // recent-books list and, unlike this sandboxed script, it can use path.
  getOpenDialogDefaultFolder: () =>
    ipcRenderer.sendSync("get-open-dialog-default-folder"),

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
    // Pass our window as the dialog's parent. Without it the dialog has no owner, so
    // Windows gives it the executable's icon (the Electron atom, in a dev run) instead of
    // ours and puts it in the taskbar as a separate app. Parenting it also makes it
    // properly modal to the window rather than a free-floating one.
    remote.dialog
      .showOpenDialog(
        remote.getCurrentWindow(),
        options as Electron.OpenDialogOptions
      )
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
