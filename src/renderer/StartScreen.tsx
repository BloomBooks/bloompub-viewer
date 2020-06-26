import { css, jsx } from "@emotion/core";
/** @jsx jsx */
import React, { useEffect, useState } from "react";
import { showOpenFile } from ".";
import { shell } from "electron";
import wordmark from "../../build/wordmark.svg";
import logo from "../../build/icon.svg";
import search from "../../build/search.svg";
import open from "../../build/open.svg";

export const StartScreen: React.FunctionComponent<{}> = (props) => {
  return (
    <div
      css={css`
        display: flex;
      `}
    >
      <div
        css={css`
          margin-left: auto;
          margin-right: auto;
          margin-top: 60px;
        `}
      >
        <img
          src={wordmark}
          css={css`
            width: 455px;
          `}
        />

        <div
          className={"choices"}
          css={css`
            margin-top: 20px;
            a {
              display: flex;
              color: #d65649;
              font-size: 24px;
              //text-decoration: underline;
              cursor: pointer;
              img {
                width: 30px;
                margin-right: 15px;
              }
            }
          `}
        >
          <a onClick={() => showOpenFile()}>
            <img src={open} css={css``} />
            Choose BloomPUB book on this computer
          </a>
          <br />
          <a
            onClick={() => {
              shell.openExternal("https://bloomlibrary.org/browse");
            }}
          >
            <img src={search} css={css``} />
            Get BloomPUB books on BloomLibrary.org
          </a>
        </div>
      </div>
    </div>
  );
};
