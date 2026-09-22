import React from "react";
const bloomPlayerHtml = "bloomplayer.htm";

// bloom-player and the book are both served by the main process's local HTTP server
// (src/main/localServer.ts). Its origin carries a port chosen at startup and a random
// token, so we have to ask for it rather than hard-code it.
function getServerOrigin(): string {
  return window.bloomPubViewMainApi.sendSync("get-local-server-origin") + "/";
}

export const Viewer: React.FunctionComponent<{
  unpackedPath: string;
}> = (props) => {
  const origin = getServerOrigin();
  const rawUrl = getUrlFromFilePath(origin, props.unpackedPath);
  const iframeSource = `${origin}${bloomPlayerHtml}?allowToggleAppBar=true&url=${encodeURIComponent(rawUrl)}&host=bloompubviewer&showBackButton=true`;
  return (
    <div className="App">
      <iframe
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block", // Prevent a 4px white bar at the bottom of the iframe. See BL-14065 and BL-14049.
        }}
        src={iframeSource}
      />
    </div>
  );
}; ////https://s3.amazonaws.com/bloomharvest/benjamin%40aconnectedplanet.org%2f130b6829-5367-4e5c-80d7-ec588aae5281/bloomdigital%2findex.htm"

// Converts a filePath into a URL. Applies appropriate encoding to any special characters.
function getUrlFromFilePath(origin: string, htmPath: string): string {
  // see https://issues.bloomlibrary.org/youtrack/issue/BL-8652 and BL-9041
  const encodedPath = htmPath.split(/[\\/]/g).map(encodeURIComponent).join("/");
  return `${origin}${encodedPath}`; // same origin as the player, so the book is not cross-origin.
}
