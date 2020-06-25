import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
const electron = require("electron");
import { ipcRenderer, remote, app } from "electron";
import * as fs from "fs";
import App from "./App";

updateMainMenu();
const path = ipcRenderer.sendSync("get-file-that-launched-me");

const title = "BloomPub Viewer " + require("../../package.json").version;

remote.getCurrentWindow().setTitle(title);

//show initial book or notice
if (path && fs.existsSync(path)) {
  showBook(path);
} else {
  showOpenFile();
}

function showBook(zipFilePath: string) {
  electron.remote.app.addRecentDocument(zipFilePath);
  ReactDOM.render(
    <App zipFilePath={zipFilePath} />,
    document.getElementById("root")
  );
}

function updateMainMenu() {
  const mainWindow = remote.getCurrentWindow();
  const macMenu = {
    label: `BloomPub Viewer`,
    submenu: [
      {
        label: `Quit`,
        accelerator: "Command+Q",
        click() {
          remote.app.quit();
        },
      },
    ],
  };

  const fileMenu = {
    label: "&" + `File`,
    submenu: [
      {
        label: "&" + `Open BloomPub...`,
        accelerator: "Ctrl+O",
        click: () => {
          showOpenFile();
        },
      },
    ],
  };
  if (fileMenu && process.platform !== "darwin") {
    //fileMenu.submenu.push({ type: "separator" });
    fileMenu.submenu.push({ role: "quit" } as any);
  }

  const template = Array<any>();
  if (process.platform === "darwin") {
    template.push(macMenu);
  }

  template.push(fileMenu);

  const menu = remote.Menu.buildFromTemplate(
    template as Electron.MenuItemConstructorOptions[]
  );

  remote.Menu.setApplicationMenu(menu);
}
function showOpenFile() {
  const options: Electron.OpenDialogOptions = {
    title: "Open BloomPub File",
    properties: ["openFile"],
    filters: [
      {
        name: "BloomPub Book",
        extensions: ["bloomd", "bloompub"],
      },
    ],
  };
  remote.dialog.showOpenDialog(options).then((result) => {
    if (!result.canceled && result.filePaths.length > 0) {
      showBook(result.filePaths[0]);
    }
  });
}
