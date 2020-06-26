import React, { useEffect, useState } from "react";

import * as fs from "fs";
import * as unzipper from "unzipper";
import * as temp from "temp";
import * as Path from "path";

temp.track();

const bloomPlayerHtml = "bloomplayer.htm";
export const Viewer: React.FunctionComponent<{ zipFilePath: string }> = (
  props
) => {
  const [htmPath, setHtmPath] = useState("");
  useEffect(() => {
    console.log("bloom htmlpath=" + bloomPlayerHtml);
    const slashIndex = props.zipFilePath
      .replace(/\\/g, "/")

      .lastIndexOf("/");

    const unpackedFolder = temp.mkdirSync("bloomPUB-viewer-");
    const stream = fs.createReadStream(props.zipFilePath);
    // This will wait until we know the readable stream is actually valid before piping
    stream.on("open", () => {
      stream.pipe(
        unzipper
          .Extract({ path: unpackedFolder })
          // unzipper calls this when it's done unzipping
          .on("close", () => {
            let filename = "index.htm";
            if (!fs.existsSync(Path.join(unpackedFolder, filename))) {
              // it must be the old method, where we named the htm the same as the bloomd (which was obviously fragile):
              const bookTitle = props.zipFilePath.substring(
                slashIndex + 1,
                props.zipFilePath.length
              );
              filename = bookTitle
                .replace(/\.bloomd/gi, ".htm")
                .replace(/\.bloompub/gi, ".htm");
            }
            setHtmPath((unpackedFolder + "\\" + filename).replace(/\\/g, "/"));
          })
      );
    });
  }, [props.zipFilePath]);

  console.log("htmPath = " + htmPath);
  return (
    <div className="App">
      {htmPath && (
        <iframe
          style={{ width: "100%", height: "100%" }}
          src={`${bloomPlayerHtml}?allowToggleAppBar=true&url=file:///${htmPath}`}
        />
      )}
    </div>
  );
}; ////https://s3.amazonaws.com/bloomharvest/benjamin%40aconnectedplanet.org%2f130b6829-5367-4e5c-80d7-ec588aae5281/bloomdigital%2findex.htm"
