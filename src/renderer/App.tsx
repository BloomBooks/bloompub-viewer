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
    if (zipPath) {
      const normalizedPath = zipPath.replace(/\\/g, "/"); // Convert Windows backslashes to forward slashes
      const bookInfo = {
        path: zipPath,
        title: Path.basename(normalizedPath, Path.extname(normalizedPath)), // Simply get basename and remove extension
        thumbnail: "", // Enhance: we could store a binhex contents of the thumbnail?
      };
      console.log("Adding book to recent: ", JSON.stringify(bookInfo, null, 2));
      window.bloomPubViewMainApi.addRecentBook(bookInfo);
      // Update the local state with the new book
      setRecentBooks((currentBooks) => {
        const newBooks = currentBooks?.filter((b) => b.path !== bookInfo.path);
        return [bookInfo, ...newBooks].slice(0, 5);
      });
    }
  }, [zipPath]);

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
