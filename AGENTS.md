# BloomPUB Viewer — notes for AI agents

## Issue tracker

This project tracks work in **Bloom's YouTrack** at https://issues.bloomlibrary.org.

- **Ticket ids look like `BL-1234`** (e.g. `BL-16708`). Branch names start with the id, as in
  `BL-16708-BloomPubViewerAndikaFonts`, and commit messages and PR titles end with it in
  parentheses.
- **The `youtrack-api` skill talks to it.** Use that skill for every tracker operation —
  reading an issue, listing or posting comments, setting state, assigning. Do not hand-roll
  REST calls.

## Project layout

- `src/main/` — Electron main process. `src/renderer/` — the React UI.
- `static/` is copied into `dist/electron/` by `webpack.renderer.config.js`, but **only in
  production builds**; `electron-builder.json5` then ships `dist/electron/**/*`. Code in the
  main process must therefore find those files at `__dirname/static/...` when packaged and in
  the source tree when running from `pnpm dev`. See `getFontsFolder()` in
  `src/main/bpubProtocolHandler.ts`.

## Commands

- `pnpm dev [book.bloompub]` — run from source with hot reload.
- `pnpm lint` — eslint (prettier runs through it).
- `pnpm build` — production webpack into `dist/electron/`.
- `pnpm build:ci` — the above plus `electron-builder`, output in `output/`.

There is no automated test suite in this repo; verification is by building and running the app.
