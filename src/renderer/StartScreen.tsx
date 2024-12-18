import { css } from "@emotion/react";

import React from "react";
import wordmark from "../../assets/wordmark.svg";
import search from "../../assets/Search.svg";
import open from "../../assets/Open.svg";
import silLogo from "../../assets/SIL_Logo_80pxTall.png";
import { setNewPrimaryBloomPub } from "./App";

export const StartScreen: React.FunctionComponent<{
  recentBooks: RecentBook[];
}> = ({ recentBooks }) => {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        * {
          color: #d65649;
        }
      `}
    >
      {/* this is all the controls, centered in the window */}
      <div
        css={css`
          margin-left: auto;
          margin-right: auto;
          margin-top: 60px;
          flex: 1;
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

              font-size: 24px;
              background: none;
              border: none;
              padding: 0;
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
              window.bloomPubViewMainApi.openLibrary();
            }}
          >
            <img src={search} />
            Get BloomPUB books on BloomLibrary.org
          </button>
        </div>

        {recentBooks && recentBooks.length > 0 && (
          <div
            css={css`
              margin-top: 30px;
              //border-top: 1px solid rgba(214, 86, 73, 0.2);
              h2 {
                font-size: 18px;
                margin-bottom: 15px;
              }

              .recent-books {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;

                button {
                  display: flex;
                  flex-direction: column;
                  width: 140px;
                  height: 170px;
                  border: none;
                  background: white;
                  cursor: pointer;
                  padding: 0;
                  padding-bottom: 10px;
                  transition: all 0.2s ease;
                  border-radius: 8px;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  overflow: hidden;

                  &:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(214, 86, 73, 0.2);
                  }

                  &:active {
                    transform: translateY(0px);
                    box-shadow: 0 2px 4px rgba(214, 86, 73, 0.1);
                  }

                  .title {
                    width: 140px;
                    box-sizing: border-box;
                    padding: 8px;
                    font-size: 14pt;
                    overflow: hidden;

                    span {
                      display: -webkit-box;
                      -webkit-line-clamp: 2;
                      -webkit-box-orient: vertical;
                      overflow: hidden;
                      //color: black;
                      font-family: "Andika", sans-serif;
                    }
                  }
                }
              }
            `}
          >
            <div
              css={css`
                font-size: 24px;
                margin-bottom: 10px;
              `}
            >
              Recent Books
            </div>
            <div className="recent-books">
              {recentBooks.slice(0, 6).map((book, index) => (
                <button
                  className="book"
                  key={index}
                  onClick={() => setNewPrimaryBloomPub(book.path)}
                  title={book.path}
                >
                  <div
                    css={css`
                      height: 100px;
                      width: 140px;

                      display: flex;
                    `}
                  >
                    {book.thumbnail && (
                      <img
                        src={book.thumbnail}
                        alt={book.title}
                        css={css`
                          height: 100px;
                          width: 140px;
                          object-fit: cover;
                          object-position: center top;
                        `}
                      />
                    )}
                  </div>
                  <div className="title">
                    <span>{book.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div
        css={css`
          display: flex;
          align-items: center;
          padding: 20px;
          margin-top: auto;
          margin-left: auto;
          margin-right: auto;
          width: 500px;
        `}
      >
        <button
          onClick={() => window.bloomPubViewMainApi.openSIL()}
          title="Visit SIL.org"
          css={css`
            display: flex;
            align-items: center;
            background: none;
            border: none;
            padding: 0;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              transform: scale(1.02);
            }

            &:active {
              transform: scale(0.98);
            }
          `}
        >
          <img
            src={silLogo}
            alt="SIL Logo"
            css={css`
              height: 30px;
            `}
          />
          <span
            css={css`
              margin-left: 10px;
              font-size: 14px;
              color: #005cb9 !important;
            `}
          >
            © SIL Global
          </span>
        </button>
      </div>
    </div>
  );
};
export function showOpenFile() {
  const options /*:Electron.OpenDialogOptions*/ = {
    title: "Open BloomPUB File",
    properties: ["openFile"],
    filters: [
      {
        name: "BloomPUB Book",
        extensions: ["bloomd", "bloompub"],
      },
      {
        name: "Bloom Source Book",
        extensions: ["bloom", "bloomSource"],
      },
    ],
  };
  window.bloomPubViewMainApi.showOpenDialog(options, (filepath: string) => {
    if (filepath) {
      setNewPrimaryBloomPub(filepath);
    }
  });
}
