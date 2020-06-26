import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import { ipcRenderer, remote, app } from "electron";
import App, { showBook } from "./App";

updateMainMenu();
const zipFilePath = ipcRenderer.sendSync("get-file-that-launched-me");

const title = "BloomPUB Viewer " + require("../../package.json").version;

remote.getCurrentWindow().setTitle(title);

ReactDOM.render(
  <App initialFilePath={zipFilePath} />,
  document.getElementById("root")
);

function updateMainMenu() {
  const mainWindow = remote.getCurrentWindow();
  const macMenu = {
    label: `BloomPUB Viewer`,
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
        label: "&" + `Open BloomPUB...`,
        accelerator: "Ctrl+O",
        click: () => {
          showOpenFile();
        },
      },
      {
        label: "&" + `Start Screen`,

        click: () => {
          showBook("");
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
export function showOpenFile() {
  const options: Electron.OpenDialogOptions = {
    title: "Open BloomPUB File",
    properties: ["openFile"],
    filters: [
      {
        name: "BloomPUB Book",
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
