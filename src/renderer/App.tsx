import React, { useEffect, useState } from "react";
import "./App.css";
// I couldn't get   import 'react-toastify/dist/ReactToastify.css'; to work, so I copied it in.
import "./ReactToastify.min.css";
import { hot } from "react-hot-loader/root";
import { ToastContainer } from "react-toastify";
import { useCheckForNewVersion } from "./useCheckForNewVersion";
import { Viewer } from "./Viewer";
import * as electron from "electron";
import { StartScreen } from "./StartScreen";

let setZipPathStatic: (path: string) => void;

const App: React.FunctionComponent<{ initialFilePath: string }> = (props) => {
  const [zipPath, setZipPath] = useState(props.initialFilePath);
  setZipPathStatic = setZipPath;
  useEffect(() => {
    electron.remote.app.addRecentDocument(zipPath);
  }, [zipPath]);
  useCheckForNewVersion();

  return (
    <>
      {(zipPath && <Viewer zipFilePath={zipPath} />) || (
        <StartScreen></StartScreen>
      )}
      <ToastContainer />
    </>
  );
};

export default hot(App);

export function showBook(zipFilePath: string) {
  setZipPathStatic(zipFilePath);
}
