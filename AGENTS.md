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

# Skills

Team-wide workflow skills that are not specific to this repo (the preflight → self-review →
peer-review pipeline, Devin review handling, YouTrack operations) live in
https://github.com/BloomBooks/bloom-team-skills — install per its README (clone + symlink into
`~/.claude/skills`).
