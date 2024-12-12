import React, { useEffect, useState } from "react";
import "./App.css";
import { Viewer } from "./Viewer";
import { StartScreen } from "./StartScreen";
import { toast, ToastContainer } from "react-toastify";
import { injectStyle } from "react-toastify/dist/inject-style";
import { Octokit } from "@octokit/rest";
import { compareVersions } from "compare-versions";
import Path from "path";

let setZipPathStatic: (path: string) => void;

// Make react-toastify styles work (without a css loader and without copying the css file into our code)
injectStyle();

interface RecentBook {
  path: string;
  thumbnail?: string;
  title: string;
}

const App: React.FunctionComponent<{
  initialFilePath: string;
  recentBooks: RecentBook[];
}> = (props) => {
  const [zipPath, setZipPath] = useState(props.initialFilePath);
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>(
    props.recentBooks
  );
  setZipPathStatic = setZipPath;

  useEffect(() => {
    window.bloomPubViewMainApi.receive(
      "zip-file-unpacked",
      (origZip: string, indexPath: string) => {
        setZipPath(indexPath);
        // Update local state from main process
        const recentBooks = window.bloomPubViewMainApi.getRecentBooks();
        setRecentBooks(recentBooks);
      }
    );
  }, []);

  console.log("Rendering with recent books:", recentBooks);
  checkForNewVersion();

  return (
    <>
      <ToastContainer></ToastContainer>
      {(zipPath && <Viewer zipFilePath={zipPath} />) || (
        <StartScreen recentBooks={recentBooks}></StartScreen>
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
          window.bloomPubViewMainApi.getCurrentAppVersion()
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
              window.bloomPubViewMainApi.openDownloadPage(
                "https://bloomlibrary.org/bloompub-viewer"
              );
            },
          }
        );
      }
    })
    .catch((err: Error) => {
      console.error("Error getting latest release info from github: \n", err);
    });
}
