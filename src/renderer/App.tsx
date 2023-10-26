import React, { useEffect, useState } from "react";
import "./App.css";
import { Viewer } from "./Viewer";
import { StartScreen } from "./StartScreen";
import { toast, ToastContainer } from "react-toastify";
import { injectStyle } from "react-toastify/dist/inject-style";
import { Octokit } from "@octokit/rest";
import compareVersions from "compare-versions";

let setZipPathStatic: (path: string) => void;

// Make react-toastify styles work (without a css loader and without copying the css file into our code)
injectStyle();

const App: React.FunctionComponent<{ initialFilePath: string }> = (props) => {
  const [zipPath, setZipPath] = useState(props.initialFilePath);
  setZipPathStatic = setZipPath;
  useEffect(() => {
    if (zipPath) {
      window.electronApi.addRecentDocument(zipPath);
    }
  }, [zipPath]);
  checkForNewVersion();

  return (
    <>
      <ToastContainer></ToastContainer>
      {(zipPath && <Viewer zipFilePath={zipPath} />) || (
        <StartScreen></StartScreen>
      )}
    </>
  );
};

export default App;

export function showBook(zipFilePath: string) {
  setZipPathStatic(zipFilePath);
}

function checkForNewVersion() {
  const octokit = new Octokit();
  octokit.repos
    .getLatestRelease({ owner: "bloombooks", repo: "bloompub-viewer" })
    .then((data) => {
      //strip out the leading "v" in "v1.2.3";
      const publishedVersion = data.data.tag_name.replace(/v/gi, "");
      if (
        compareVersions(
          publishedVersion,
          window.electronApi.getCurrentAppVersion()
        ) > 0
      ) {
        toast.success(
          `Click to get new version of BloomPUB Viewer (${data.data.name})`,
          {
            position: "bottom-right",
            autoClose: 15000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            onClick: () => {
              window.electronApi.openDownloadPage(data.data.html_url);
            },
          }
        );
      }
    })
    .catch((err: Error) => {
      console.error("Error getting latest release info from github: \n", err);
    });
}
