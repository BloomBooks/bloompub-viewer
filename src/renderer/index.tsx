import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { toast } from "react-toastify";
import { App, setNewPrimaryBloomPub } from "./App";
import { showOpenFile } from "./StartScreen";
updateMainMenu();
const bloomPubFilePath = window.bloomPubViewMainApi.sendSync(
  "get-file-that-launched-me"
);

const root = createRoot(document.getElementById("root")!);
root.render(<App primaryBloomPubPath={bloomPubFilePath} />); // React 18+ syntax / rendering mode.

// Add handler for files opened while app is running
window.bloomPubViewMainApi.receive("open-file", (filePath: string) => {
  setNewPrimaryBloomPub(filePath);
});

function updateMainMenu() {
  const macMenu = {
    label: `BloomPUB Viewer`,
    submenu: [
      {
        label: `Quit`,
        accelerator: "Command+Q",
        click() {
          window.bloomPubViewMainApi.quit();
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
          setNewPrimaryBloomPub("");
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
            window.bloomPubViewMainApi.sendSync("toggleFullScreen");

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
          window.bloomPubViewMainApi.send("exitFullScreen");
        },
      },
      {
        label: "Toggle &Developer Tools",
        accelerator: "F12",
        visible: false,
        click() {
          window.bloomPubViewMainApi.send("toggleDevTools");
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
  window.bloomPubViewMainApi.setApplicationMenu(template);
}
