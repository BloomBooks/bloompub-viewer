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
  // This renderer deliberately has no node integration (BL-8994), so `process` does
  // not exist here. webpack 4 used to shim it for browser targets, where
  // process.platform was the literal string "browser" -- meaning the macOS branches
  // below never ran and macOS quietly got the Windows/Linux menu. Vite does not shim
  // it, which turned that silent bug into "process is not defined" on load. Ask the
  // browser, which is the right question for a renderer.
  //
  // Declared in here rather than at module scope on purpose: updateMainMenu() is
  // called at the top of this file, above where a module-level `const` would be
  // initialized, so hoisting rules would put it in the temporal dead zone.
  const isMac = navigator.platform.startsWith("Mac");

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
      // Typed as Electron's own menu shape so the { role: "quit" } item pushed in
      // below fits without a cast; inferring it from these two entries alone would
      // make `label` and `click` mandatory.
    ] as Electron.MenuItemConstructorOptions[],
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

  if (fileMenu && !isMac) {
    //fileMenu.submenu.push({ type: "separator" });
    fileMenu.submenu.push({ role: "quit" });
  }

  const template: Electron.MenuItemConstructorOptions[] = [];
  if (isMac) {
    template.push(macMenu);
  }

  template.push(fileMenu);
  template.push(viewMenu);
  window.bloomPubViewMainApi.setApplicationMenu(template);
}
