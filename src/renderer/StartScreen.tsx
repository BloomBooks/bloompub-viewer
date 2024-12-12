import { css } from "@emotion/react";

import React from "react";
import { showOpenFile, openFile } from ".";
import wordmark from "../../assets/wordmark.svg";
import search from "../../assets/Search.svg";
import open from "../../assets/Open.svg";

interface RecentBook {
  path: string;
  thumbnail: string;
  title: string;
}

interface StartScreenProps {
  recentBooks: RecentBook[];
}

export const StartScreen: React.FunctionComponent<StartScreenProps> = ({
  recentBooks,
}) => {
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
              border-top: 1px solid rgba(214, 86, 73, 0.2);
              padding-top: 20px;

              h2 {
                color: #d65649;
                font-size: 18px;
                margin-bottom: 15px;
              }

              .recent-books {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;

                button {
                  border: none;
                  background: none;
                  cursor: pointer;
                  padding: 10px;
                  transition: all 0.2s ease;
                  text-align: left;

                  &:hover {
                    transform: scale(1.02);
                    background-color: rgba(214, 86, 73, 0.05);
                  }

                  img {
                    width: 100%;
                    height: 120px;
                    object-fit: cover;
                    margin-bottom: 8px;
                  }

                  .title {
                    color: #d65649;
                    font-size: 14px;
                  }
                }
              }
            `}
          >
            <h2>Recent Books</h2>
            <div className="recent-books">
              {recentBooks.slice(0, 3).map((book, index) => (
                <button key={index} onClick={() => openFile(book.path)}>
                  <img src={book.thumbnail} alt={book.title} />
                  <div className="title">{book.title}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
