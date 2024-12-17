import React, { useEffect, useState } from "react";
import "./App.css";
import { Viewer } from "./Viewer";
import { StartScreen } from "./StartScreen";
import { toast, ToastContainer } from "react-toastify";
import { injectStyle } from "react-toastify/dist/inject-style";
import { Octokit } from "@octokit/rest";
import { compareVersions } from "compare-versions";

export let setNewPrimaryBloomPub: (path: string) => void;

// Make react-toastify styles work (without a css loader and without copying the css file into our code)
injectStyle();

export const App: React.FunctionComponent<{ primaryBloomPubPath: string }> = (
  props
) => {
  const [bloomPubPath, setBloomPubPath] = useState(props.primaryBloomPubPath);
  const [primaryHtmlPath, setPrimaryHtmlPath] = useState("");
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([]);

  useEffect(() => {
    setNewPrimaryBloomPub = (path: string) => {
      setPrimaryHtmlPath("");
      setBloomPubPath("");
      if (path) {
        // if we're just going back to the start screen, don't bother the main process
        // request the main process to load this book. It will call us back with "book-ready-to-display"
        window.bloomPubViewMainApi.send("switch-primary-book", path);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.bloomPubViewMainApi.receive(
      "book-ready-to-display",
      (receivedBloomPubPath: string, indexHtmlPath: string) => {
        console.log(
          `Received book-ready-to-display: ${receivedBloomPubPath}, html: ${indexHtmlPath}`
        );
        setBloomPubPath(receivedBloomPubPath);
        setPrimaryHtmlPath(indexHtmlPath);
        setRecentBooks(window.bloomPubViewMainApi.getRecentBooks());
      }
    );
    return () => unsubscribe?.();
  }, []); // Empty dependency array since this should only run once

  useEffect(() => {
    const unsubscribe = window.bloomPubViewMainApi.receive(
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
    const unsubscribe = window.bloomPubViewMainApi.receive(
      "switch-primary-book-failed",
      (receivedBloomPubPath: string, reason: string) => {
        toast.error(`Something went wrong opening that book: ${reason}`);

        // recalculate recent books, in case we clicked on a recent book button
        // for a book that isn't there anymore
        setRecentBooks(window.bloomPubViewMainApi.getRecentBooks());
      }
    );
    return () => unsubscribe?.();
  }, []);
  useEffect(() => {
    const handleBackButton = (event: MessageEvent) => {
      // try to parse the event.data into an object
      if (event.data) {
        try {
          const data = JSON.parse(event.data);

          if (data.messageType === "backButtonClicked") {
            setNewPrimaryBloomPub("");
          }
        } catch (err) {
          //some other message, not the kind bloom-player sends
        }
      }
    };
    window.addEventListener("message", handleBackButton);
    return () => window.removeEventListener("message", handleBackButton);
  }, []);

  useEffect(() => {
    setRecentBooks(window.bloomPubViewMainApi.getRecentBooks());
  }, []);

  checkForNewVersion();

  return (
    <>
      <ToastContainer></ToastContainer>
      {(bloomPubPath && primaryHtmlPath && (
        <Viewer unpackedPath={primaryHtmlPath} />
      )) || <StartScreen recentBooks={recentBooks}></StartScreen>}
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
