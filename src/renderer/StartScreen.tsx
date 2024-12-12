import { css } from "@emotion/react";

import React from "react";
import { showOpenFile, openFile } from ".";
import wordmark from "../../assets/wordmark.svg";
import search from "../../assets/Search.svg";
import open from "../../assets/Open.svg";
import bookPlaceholder from "../../assets/book-placeholder.svg";

interface RecentBook {
  path: string;
  thumbnail?: string;
  title: string;
}

interface StartScreenProps {
  recentBooks: RecentBook[];
}

export const StartScreen: React.FunctionComponent<StartScreenProps> = ({
  recentBooks,
}) => {
  console.log("StartScreen rendering with books:", recentBooks);
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
                  background: white;
                  cursor: pointer;
                  padding: 15px;
                  transition: all 0.2s ease;
                  text-align: left;
                  border-radius: 8px;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

                  &:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(214, 86, 73, 0.2);
                  }

                  &:active {
                    transform: translateY(0px);
                    box-shadow: 0 2px 4px rgba(214, 86, 73, 0.1);
                  }

                  img {
                    width: 100%;
                    height: 60px;
                    object-fit: cover;
                    margin-bottom: 10px;
                    border-radius: 4px;
                  }

                  .title {
                    color: #d65649;
                    font-size: 14px;
                    font-weight: 500;
                    line-height: 1.3;
                  }
                }
              }
            `}
          >
            <h2>Recent Books ({recentBooks.length})</h2>
            <div className="recent-books">
              {recentBooks.slice(0, 3).map((book, index) => (
                <button key={index} onClick={() => openFile(book.path)}>
                  <img
                    src={book.thumbnail || bookPlaceholder}
                    alt={book.title}
                  />
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
