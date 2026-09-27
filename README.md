# dsh-memory

English | [中文](README.zh.md)

## Background: DeepSeek Harness

DeepSeek Harness (`dsh`) is the open-source agent harness from DeepSeek AI, where nearly every capability is a plugin on [Cordis](https://github.com/cordiverse/cordis). It is in **developer preview** and iterating fast, so expect compatibility-breaking changes ([docs](https://deepseek-harness.github.io/deepseek-harness/), `0.1.7-alpha.*`); this plugin is a standalone third-party package that resolves `@deepseek-ai/*` from the running host.

## The problem this plugin solves

A session forgot everything between runs; this plugin gives it a Claude-shaped memory directory (`MEMORY.md` plus one file per memory), a `memory` tool, and a settings section.

## Screenshots

Screenshots pending — this plugin has no captured UI yet.

## Install

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-memory
```

From the npm registry: <https://www.npmjs.com/package/@guowenzhang/dsh-memory> — restart the host afterwards; local checkouts, git sources and troubleshooting are in [AGENTS.md](AGENTS.md).

## Usage

### Turn memory on or off

**Settings → Memory** starts with **Enable memory**, on by default. It is the master switch: off, no index is folded into new sessions and the `memory` tool is not registered, and nothing on disk is deleted.

### What the memory directory holds

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
- [build-and-test.md](build-and-test.md) — build ~45s, Vitest, dev server on 3001
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

### Choose the memory directory

The **Memory directory template** field decides where the store lives; `~` is your user home and `{project}` is the current project's directory name.

| Form | Resolves to |
|---|---|
| `~/.dsh/memory/{project}` (default) | One subdirectory per project, so projects never share memories |
| `~/.dsh/memory` | One store shared by every project (drop `{project}` to share) |
| `~/.claude/projects/{project}/memory` | The same store the **Use Claude's directory** switch selects |

`{project}` is the git repository root of the session's working directory (a `.git` file — a linked worktree — is resolved back to the main repository), with every character outside `[A-Za-z0-9]` replaced by `-`: `C:\02-codespace\deepseek-harness` becomes `C--02-codespace-deepseek-harness`, exactly the directory name Claude writes under `~/.claude/projects/`.

**Choose directory…** opens the OS picker when the host composes one and the in-app directory browser otherwise; typing a path into the field works everywhere. Beside it, **Directory state** reports the directory the current project resolves to, the index's lines and bytes, the file count and total size, and the file cap.

### Share Claude Code's own directory

**Use Claude's directory is off by default.** While it is off, memory lives in your own directory, which you choose and can change at any time; while it is on, there is no directory to choose — the store is Claude Code's `~/.claude/projects/<project>/memory`, shared with Claude itself. Turning it back off returns you to the directory you had configured.

### Look at another project

Memory is stored per project, so the page shows one at a time: the **Directory state** block and the **MEMORY.md index** editor describe whichever project the **Project** dropdown selected. The list is

- the current project (the one the host process runs in),
- every DSH workspace,
- and, with **Use Claude's directory** on, every project directory under `<claude home>/projects/`.

Rows are deduplicated by the directory they resolve to, so one repository appears once, and a single-project deployment shows no dropdown at all. Selecting another project only changes what the page reads and edits: the template is untouched, and every session still resolves its own directory.

### Save a memory

Saving takes two steps: write the memory file, then add one pointer line to `MEMORY.md` — the index holds pointers, not content. The injected instructions state that protocol and the model follows it; you can also edit the index directly in the settings page's **MEMORY.md index** editor.

### Use the `memory` tool

The model reaches the whole store through one `memory` tool whose paths are addressed under `/memories`, and every reply is the tool's own wording — including the failures, which are returned rather than thrown (`Error: File … already exists`, `Please ensure it is unique`, …). The `view` line ceiling, `view_range`, the two-level directory listing, the hidden-item and `node_modules` exclusions, `/memories` addressing, `create` failing on an existing file, the unique `old_str` requirement, the 0-based `insert_line`, `delete` refusing the root, and `rename` refusing an existing destination all match Claude's memory tool.

| Command | Behavior |
|---|---|
| `view` | Lists a directory two levels deep, hidden entries and `node_modules` excluded, or shows a file with line numbers; `view_range: [start, end]` windows a file |
| `create` | Writes a new file, creating parent directories; fails when the path already exists |
| `str_replace` | Replaces an `old_str` that must occur exactly once; reports the line numbers when it occurs more than once |
| `insert` | Inserts text at the 0-based `insert_line` |
| `delete` | Removes a file, or a directory and its contents; refuses the `/memories` root |
| `rename` | Moves an entry; refuses an existing destination |

### What a session loads

The first request of every session folds one instructions message: the memory protocol plus the current `MEMORY.md`, the first **200 lines or 25 KB** — the same bound Claude loads by. The message is recorded on the Session log, so a resumed session is not given it twice; the bound is a **load** limit, not a trim, and the rest of the index stays on disk, out of the request.

## Notes and caveats

- **No `modified` frontmatter stamp.** Claude Code adds an ISO-8601 timestamp when it writes through its normal file tools; this plugin never rewrites what the model wrote.
- **A 1 MiB per-file cap.** The largest single memory file this plugin reads or writes is 1 MiB by default.
- **No `#` append shortcut**: current official Claude documentation has none either (interactive mode lists only `/`, `!`, `@`, `:`, `?`). To record something by hand, edit the index in the settings page or have the model use the `memory` tool.
- **No maintenance of its own**: the plugin never summarizes, archives, or deletes a memory — a write happens only when the model calls the `memory` tool, and a deletion only when the model runs `delete` or you do it from the settings page.
- **Paths outside the memory directory are refused**: `../`, absolute paths, and drive-qualified paths never escape `/memories`, and a symlink inside the directory cannot redirect a write outside it.
- **A new settings section needs a browser hard-refresh** (Ctrl+F5), because the page holds the boot graph it loaded; restarting the host alone does not rebuild it.
- **`CLAUDE.md` instruction files are not this plugin's surface** — that is [`@guowenzhang/dsh-claude-compat`](https://github.com/zhang-guo-wen/dsh-claude-compat). The two are independent and install separately.

## License

The plugin itself is Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Portions of the plugin contract, the settings section, and the Remote surface are derived from DeepSeek Harness and remain under the MIT License reproduced in [NOTICE](NOTICE).

## Further reading

- [AGENTS.md](AGENTS.md) — install variants, how the plugin is composed into a profile, every configuration field and its default, build and deployment semantics, release steps, and troubleshooting.
- [docs/implementation.md](docs/implementation.md) — the implementation reference: directory resolution, the store, injection timing, and the settings page's Remote.
- [tests/README.md](tests/README.md) — the spec runners and what each spec covers.
- [@guowenzhang/dsh-claude-compat](https://github.com/zhang-guo-wen/dsh-claude-compat) — the sibling plugin for `CLAUDE.md` instruction files, skills, and scope rules.
- [@guowenzhang/dsh-mcp-manager](https://github.com/zhang-guo-wen/dsh-mcp-manager) — the sibling plugin for MCP.
- [DeepSeek Harness documentation](https://deepseek-harness.github.io/deepseek-harness/).
