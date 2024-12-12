import { css } from "@emotion/react";

import React from "react";
import { showOpenFile } from ".";
import wordmark from "../../assets/wordmark.svg";
import search from "../../assets/Search.svg";
import open from "../../assets/Open.svg";

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
            button {
              display: flex;
              align-items: center;
              color: #d65649;
              font-size: 24px;
              background: none;
              border: none;
              padding: 10px;
              cursor: pointer;
              transition: all 0.2s ease;
              width: 100%;

              img {
                width: 30px;
                margin-right: 15px;
              }

              &:hover {
                transform: scale(1.02);
                color: #e06357;
                background-color: rgba(214, 86, 73, 0.05);
              }

              &:active {
                transform: scale(0.98);
                color: #c04d41;
              }
            }
          `}
        >
          <button onClick={() => showOpenFile()}>
            <img src={open} />
            Choose BloomPUB book on this computer
          </button>
          <br />
          <button
            onClick={() => {
              window.electronApi.openLibrary();
            }}
          >
            <img src={search} />
            Get BloomPUB books on BloomLibrary.org
          </button>
        </div>
      </div>
    </div>
  );
};
