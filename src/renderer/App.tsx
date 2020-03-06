import React, { useEffect, useState } from "react";
import "./App.css";
import { hot } from "react-hot-loader/root";

import * as fs from "fs";
import * as unzipper from "unzipper";
import * as temp from "temp";
//import bloomPlayerJS from "./bloomPlayer.min.js";
//import bloomPlayerHtml from "../../node_modules/bloom-player/dist/bloomplayer.htm";

const bloomPlayerHtml = "bloomplayer.htm";
//const bloomdPath = "D:\\temp\\The Moon and the Cap.bloomd";
const App: React.FunctionComponent<{ bloomdPath: string }> = props => {
  const [htmPath, setHtmPath] = useState("");

  useEffect(() => {
    console.log("bloom htmlpath=" + bloomPlayerHtml);
    const slashIndex = props.bloomdPath
      .replace(/\\/g, "/")

      .lastIndexOf("/");
    let bookTitle: string;
    bookTitle = props.bloomdPath.substring(
      slashIndex + 1,
      props.bloomdPath.length
    );
    const filename = bookTitle.replace(".bloomd", ".htm");
    temp.track();
    temp.mkdir("bloom-reader-", (err, p) => {
      fs.createReadStream(props.bloomdPath).pipe(unzipper.Extract({ path: p }));
      console.log("booktitle = " + bookTitle);
      console.log("filename = " + filename);
      console.log("temp path = " + p);
      // for some reason electron isn't actually ready for bloom-player to make requests yet
      // initially, hence the delay
      window.setTimeout(
        () => setHtmPath((p + "\\" + filename).replace(/\\/g, "/")),
        1000
      );
    });
  }, [props.bloomdPath]);

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

export default hot(App);
