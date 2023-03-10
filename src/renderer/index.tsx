import React from "react";
import ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import "./index.css";
import App, { showBook } from "./App";
import { toast } from "react-toastify";

updateMainMenu();
const zipFilePath = window.electronApi.sendSync("get-file-that-launched-me");

const root = createRoot(document.getElementById("root")!);
root.render(<App initialFilePath={zipFilePath} />); // React 18+ syntax / rendering mode.

function updateMainMenu() {
  const macMenu = {
    label: `BloomPUB Viewer`,
    submenu: [
      {
        label: `Quit`,
        accelerator: "Command+Q",
        click() {
          window.electronApi.quit();
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

  const viewMenu = {
    label: "&" + `View`,
    submenu: [
      {
        label: "&" + `Full Screen`,
        accelerator: "F11",
        click: () => {
          const isNowFullScreen =
            window.electronApi.sendSync("toggleFullScreen");

          if (isNowFullScreen) {
            toast.info(`Press F11 or ESC to exit full screen`, {
              position: "top-left",
              icon: false,
              autoClose: 3000,
              hideProgressBar: true,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: false,
              progress: undefined,
            });
          }
        },
      },
      {
        label: "Exit full screen",
        visible: false,
        accelerator: "Esc",
        click() {
          window.electronApi.send("exitFullScreen");
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
  template.push(viewMenu);
  window.electronApi.setApplicationMenu(template);
}
export function showOpenFile() {
  const options /*:Electron.OpenDialogOptions*/ = {
    title: "Open BloomPUB File",
    properties: ["openFile"],
    filters: [
      {
        name: "BloomPUB Book",
        extensions: ["bloomd", "bloompub"],
      },
    ],
  };
  window.electronApi.showOpenDialog(options, (filepath: string) => {
    if (filepath) {
      showBook(filepath);
    }
  });
}
