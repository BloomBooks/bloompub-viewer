import React, { useEffect, useState } from "react";
import "./App.css";
import { Viewer } from "./Viewer";
import { StartScreen } from "./StartScreen";
import { toast, ToastContainer } from "react-toastify";
import { injectStyle } from "react-toastify/dist/inject-style";
import { Octokit } from "@octokit/rest";
import { compareVersions } from "compare-versions";

export let openNewPrimaryBloomPub: (path: string) => void;

// Make react-toastify styles work (without a css loader and without copying the css file into our code)
injectStyle();

export const App: React.FunctionComponent<{ initialBloomPubPath: string }> = (
  props
) => {
  const [bloomPubPath, setBloomPubPath] = useState(props.initialBloomPubPath);
  const [primaryHtmlPath, setPrimaryHtmlPath] = useState("");
  openNewPrimaryBloomPub = setBloomPubPath;

  useEffect(() => {
    if (bloomPubPath) {
      window.electronApi.addRecentDocument(bloomPubPath);
      window.electronApi.send("switch-primary-book", bloomPubPath);
    }
  }, [bloomPubPath]);

  useEffect(() => {
    const unsubscribe = window.electronApi.receive(
      "uncaught-error",
      (errorMessage) => {
        toast.error(`${errorMessage}`, {
          toastId: errorMessage,
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        setBloomPubPath("");
        setPrimaryHtmlPath("");
      }
    );
    return () => unsubscribe?.();
  }, []); // Empty dependency array since this should only run once

  useEffect(() => {
    const unsubscribe = window.electronApi.receive(
      "bloomPub-ready",
      (bloomPubPath: string, indexHtmlPath: string) => {
        if (bloomPubPath === bloomPubPath) {
          setPrimaryHtmlPath(indexHtmlPath);
        }
      }
    );
    return () => unsubscribe?.();
  }, [bloomPubPath]);

  checkForNewVersion();

  return (
    <>
      <ToastContainer></ToastContainer>
      {(bloomPubPath && primaryHtmlPath && (
        <Viewer unpackedPath={primaryHtmlPath} />
      )) || <StartScreen></StartScreen>}
    </>
  );
};

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
              window.electronApi.openDownloadPage(
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
