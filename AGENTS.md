# Issue tracker

This project tracks work in **YouTrack**, at https://issues.bloomlibrary.org/youtrack (Kanban
boards) — the same tracker as BloomDesktop. Ticket ids look like **`BL-16572`** (`BL-` plus a
number). The skill that talks to it is **`youtrack-api`** — use it for any tracker operation (read
an issue, find the id for the current work, list/post comments, set an issue's State); the
higher-level `youtrack-*` skills build on it.

To find the ticket id for the branch you are on, look for a `BL-XXXXX` token in the branch name,
then the PR title, then recent commit messages. Not every branch has a card — plenty of work in
this repo (dependency upgrades, tooling, small cleanups) is done without one, so finding no id is a
normal outcome, not a reason to go hunting.

# Platforms

We ship and support **Windows** and **Linux**. We do **not** run on macOS yet.

`electron-builder.json5` still carries `mac` and `dmg` configuration, and `src/main/index.ts` has a
macOS branch or two, so the code reads as though all three are supported. Treat that as
aspirational: a macOS-only concern is not a reason to hold up a change, and macOS behavior is not
something to claim as verified. Linux, on the other hand, is real — CI builds a `.deb` on every PR,
and `assets/deb/` carries an AppArmor profile plus post-install scripts, so platform-specific
behavior does need thinking about there.

# Skills

Team-wide workflow skills that are not specific to this repo (the preflight → self-review →
peer-review pipeline, Devin review handling, YouTrack operations) live in
https://github.com/BloomBooks/bloom-team-skills — install per its README (clone + symlink into
`~/.claude/skills`).

# Project layout

- `src/main/` is the Electron main process; `src/renderer/` is the React UI.
- `static/` reaches a shipped build by an indirect route worth knowing about:
  `.electron-react/webpack.renderer.config.js` copies it to `dist/electron/static/`, but **only
  in production builds**, and `electron-builder.json5` then packs `dist/electron/**/*`. So main
  process code must find those files at `__dirname/static/...` when packaged, and in the source
  tree when running from `pnpm dev`. `getFontsFolder()` in `src/main/bpubProtocolHandler.ts` is
  the worked example — getting this wrong is what BL-16708 was.

# Commands

- `pnpm dev [book.bloompub]` — run from source with hot reload.
- `pnpm lint` — eslint (prettier runs through it).
- `pnpm build` — production webpack into `dist/electron/`.
- `pnpm build:ci` — the above plus `electron-builder`; installers land in `output/`.

There is no automated test suite in this repo; verification is by building and running the app.
