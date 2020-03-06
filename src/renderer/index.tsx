import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import { ipcRenderer, remote } from "electron";

updateMainMenu();
const path = ipcRenderer.sendSync("get-file-that-launched-me");
remote.getCurrentWindow().setTitle("Bloom Viewer");

//show initial book or notice
showBook(path);

function showBook(bloomdPath: string) {
  console.log(`path ='${bloomdPath}'`);
  if (path) {
    ReactDOM.render(
      <App bloomdPath={bloomdPath} />,
      document.getElementById("root")
    );
  } else {
    ReactDOM.render(
      <h1>
        Our apologies... please quit this app, then double click on a .bloomd
        file to run open it.
      </h1>,
      document.getElementById("root")
    );
  }
}

function updateMainMenu() {
  const mainWindow = remote.getCurrentWindow();
  const macMenu = {
    label: `Bloom Viewer`,
    submenu: [
      {
        label: `Quit`,
        accelerator: "Command+Q",
        click() {
          remote.app.quit();
        }
      }
    ]
  };

  const fileMenu = {
    label: "&" + `File`,
    submenu: [
      {
        label: "&" + `Open BloomPub...`,
        accelerator: "Ctrl+O",
        click: () => {
          const options: Electron.OpenDialogOptions = {
            properties: ["openFile"],
            filters: [
              {
                name: "Bloom Digital Book",
                extensions: ["bloomd", "bloompub"]
              }
            ]
          };
          remote.dialog.showOpenDialog(options).then(result => {
            if (!result.canceled && result.filePaths.length > 0) {
              showBook(result.filePaths[0]);
            }
          });
        }
      }
    ]
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
