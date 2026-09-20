# dsh-memory

English | [中文](README.zh.md)

A standalone plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) that gives a session a
**memory directory in Claude's own shape** — index format, tool protocol, and directory layout — with the directory
chosen by you, including Claude Code's own `~/.claude/projects/<project>/memory`.

It does not bundle `@deepseek-ai/*`; those resolve from the host harness at runtime.

## What it does

- **A memory directory.** An index named `MEMORY.md` plus one topic file per memory, the same layout as Claude's
  auto-memory directory — **one subdirectory per project** by default.
- **The `memory` tool.** `view` / `create` / `str_replace` / `insert` / `delete` / `rename`, addressed through
  `/memories`, answering with Claude's own reply strings (`Error: File … already exists`,
  `Please ensure it is unique`, …).
- **Session injection.** The first request of every session folds one instructions message: the memory protocol plus
  the current `MEMORY.md` (first 200 lines or 25 KB, as Claude loads it). The message is recorded on the Session log,
  so a resumed session is not given it twice.
- **A settings section.** Master switch, a **Use Claude's directory** switch, a directory-template field with a chooser
  (the OS picker when the host composes one, an in-app directory browser otherwise), a **project dropdown** that shows
  any project's store, the selected store's state (index lines/bytes, file count and total), and an editor for
  `MEMORY.md`.

**Use Claude's directory is off by default.** While it is off, memory lives in your own directory, which you choose and
can change at any time; while it is on, there is no directory to choose — the store is Claude Code's
`~/.claude/projects/<project>/memory`, shared with Claude itself.

`CLAUDE.md` instruction files are **not** this plugin's surface — that is
[`@zhang-guo-wen/dsh-claude-compat`](https://github.com/zhang-guo-wen/dsh-claude-compat). The two are independent and
install separately.

## Install

The built `lib/` is committed, so the repository installs and runs directly — no build step on your machine.

```sh
# over HTTPS
npx @deepseek-ai/dsh plugin --profile web add git+https://github.com/zhang-guo-wen/dsh-memory.git

# or over SSH
npx @deepseek-ai/dsh plugin --profile web add git+ssh://git@github.com/zhang-guo-wen/dsh-memory.git

# local development (pnpm links the directory, so a rebuilt lib/ reaches the host on restart)
npx @deepseek-ai/dsh plugin --profile web add /absolute/path/to/dsh-memory

# pin a release tag
npx @deepseek-ai/dsh plugin --profile web add "git+ssh://git@github.com/zhang-guo-wen/dsh-memory.git#v0.1.0"
```

Restart the host (or let a `patchReload: live` profile recompose), then **hard-refresh the browser** (Ctrl+F5): the
browser holds the previous boot graph, so a new settings section is not visible before that.

Remove it, dependency and layer together, with
`npx @deepseek-ai/dsh plugin --profile web remove @zhang-guo-wen/dsh-memory`.

## Configuration

Every field has a working default. The settings page writes `enabled` and `directory`; the rest are composition fields.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Fold the index into a session and register the `memory` tool |
| `claudeCompatible` | `false` | Use Claude Code's own memory directory; while on, `directory` is ignored and nothing has to be chosen |
| `directory` | `~/.dsh/memory/{project}` | Memory directory; accepts `~` and `{project}` |
| `claudeHome` | `$CLAUDE_CONFIG_DIR`, `$CLAUDE_HOME`, or `~/.claude` | Claude config directory; locates `projects/<project>/memory` in Claude-directory mode |
| `indexLines` | `200` | Lines of the index a session loads, matching Claude Code |
| `indexBytes` | `25600` | UTF-8 bytes of the index a session loads, matching Claude Code |
| `maxFileBytes` | `1048576` | Largest single memory file this plugin reads or writes |
| `projectRootMarkers` | `['.git']` | Directory entries that identify the project root |

### Directory forms

| Form | Resolves to |
|---|---|
| `~/.dsh/memory/{project}` (default) | One subdirectory per project, so projects never share memories |
| `~/.dsh/memory` | One store shared by every project (drop `{project}` to share) |
| `~/.claude/projects/{project}/memory` | The same store the **Use Claude's directory** switch selects |

### Looking at another project

Memory is stored per project, so the page shows one at a time: the state block and the index editor describe whichever
project the dropdown selected. The list is

- the current project (the one the host process runs in),
- every DSH workspace,
- and, with **Use Claude's directory** on, every project directory under `<claude home>/projects/`.

Rows are deduplicated by the directory they resolve to, so one repository appears once, and a single-project
deployment shows no dropdown at all. Selecting another project only changes what the page reads and edits: the
template is untouched, and every session still resolves its own directory.

`{project}` is the git repository root of the session's working directory (a `.git` file — a linked worktree — is
resolved back to the main repository), with every character outside `[A-Za-z0-9]` replaced by `-`:
`C:\02-codespace\deepseek-harness` becomes `C--02-codespace-deepseek-harness`, exactly the directory name Claude
writes under `~/.claude/projects/`.

## What the directory holds

```
<memory>/
├── MEMORY.md          # Index: one line per memory, no frontmatter, loaded at session start
├── debugging.md       # One memory per file, with frontmatter
└── ...
```

Index lines:

```markdown
# Memory Index

## Project
- [build-and-test.md](build-and-test.md) — npm run build (~45s), Vitest, dev server on 3001
- [architecture.md](architecture.md) — API client singleton, refresh-token auth
```

Topic files:

```markdown
---
name: debugging-patterns
description: Auth token rotation and database connection troubleshooting
metadata:
  type: reference
---

## Auth tokens
...
```

Saving takes two steps: write the memory file, then add one pointer line to `MEMORY.md` (the index holds pointers, not
content). The injected instructions state the protocol and the model follows it; you can also edit the index from the
settings page.

## Differences from Claude

- **No `modified` frontmatter stamp.** Claude Code adds an ISO-8601 timestamp when it writes through its normal file
  tools; this plugin never rewrites what the model wrote.
- **A 1 MiB per-file cap** (configurable). The `view` line ceiling, `view_range`, the two-level directory listing, the
  hidden-item and `node_modules` exclusions, `/memories` addressing, `create` failing on an existing file, the unique
  `old_str` requirement, the 0-based `insert_line`, recursive `delete` that refuses the root, and `rename` refusing an
  existing destination all match Claude's memory tool.
- **No `#` append shortcut**: current official Claude documentation has none either (interactive mode lists only
  `/`, `!`, `@`, `:`, `?`). To record something by hand, edit the index in the settings page or have the model use the
  `memory` tool.
- **Paths outside the memory directory are refused**: `../`, absolute paths, and drive-qualified paths never escape
  `/memories`, and a symlink inside the directory cannot redirect a write outside it.

## Development

See [AGENTS.md](AGENTS.md) for the repo layout, build, and deployment; [docs/implementation.md](docs/implementation.md)
for the implementation reference; [tests/README.md](tests/README.md) for the spec runners.
