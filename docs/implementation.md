---
description: "Claude-compatible memory for the DeepSeek Harness: the memory directory, the memory tool, session injection, and the settings page."
kind: "package-reference"
---

# @zhang-guo-wen/dsh-memory

English | [中文](implementation.zh.md)

> Package reference. For what this plugin does and how to install it, see the
> [repository README](../README.md).

## Summary

Claude keeps a memory directory beside the instructions: an index file named `MEMORY.md` plus one topic file per
memory, written through a `memory` tool whose six commands address everything under `/memories`. This package mounts
that store on a directory the operator chooses. A session's first request carries the memory protocol and the loaded
index; the model maintains the store through the tool; the settings page points the directory at any folder, including
Claude Code's own `projects/<project>/memory`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin beside the tool registry; it requires `ctx.tools`. A profile `patch` or a preset composition inserts
it like any other plugin.

```yaml
- name: '@deepseek-ai/dsh-tools'
- name: '@zhang-guo-wen/dsh-memory'
  config:
    claudeCompatible: true
```

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Fold the index into a session and register the `memory` tool |
| `claudeCompatible` | `false` | Use Claude Code's own `<claude home>/projects/<project>/memory`; while on, `directory` is ignored |
| `directory` | `~/.dsh/memory/{project}` | Memory directory; `~` and `{project}` expand |
| `claudeHome` | `$CLAUDE_CONFIG_DIR`, `$CLAUDE_HOME`, `~/.claude` | Claude config directory for `claudeCompatible` |
| `indexLines` | `200` | Lines of the index a session loads |
| `indexBytes` | `25600` | UTF-8 bytes of the index a session loads |
| `maxFileBytes` | `1048576` | Largest single memory file read or written |
| `projectRootMarkers` | `['.git']` | Directory entries that identify the project root |

`enabled`, `directory`, and `claudeCompatible` also have settings-page fields in the `memory` namespace, so an operator
can move the store without touching the composition. The page hides the directory field while `claudeCompatible` is on,
because that mode derives the directory and has nothing to choose.

### Directory resolution

`~` expands against the process user home. `{project}` is replaced by the Claude-style name of the session project:
the git repository root of the session working directory — a `.git` file (a linked worktree) resolves back to the main
repository through its `gitdir:` line — with every character outside `[A-Za-z0-9]` replaced by `-`. Without a
repository, the working directory itself names the project. Resolution is per session, so the default
`~/.dsh/memory/{project}` gives each project its own store.

With `claudeCompatible` on, the directory is instead `<claude home>/projects/<project>/memory` — Claude Code's own
auto-memory directory — and no directory is chosen. `directory` is ignored in that mode rather than cleared, so
turning the switch off returns the operator to the directory they had configured.

### The `memory` tool

| Command | Required fields | Behavior |
|---|---|---|
| `view` | `path` | Lists a directory up to two levels deep (hidden entries and `node_modules` excluded), or shows a file with line numbers; `view_range: [start, end]` windows a file, `-1` as the end means end of file |
| `create` | `path`, `file_text` | Writes a new file, creating parent directories; fails when the path already exists |
| `str_replace` | `path`, `old_str` | Replaces text that must occur exactly once; reports the line numbers when it occurs more than once |
| `insert` | `path`, `insert_line`, `insert_text` | Inserts at a 0-based line index in `[0, line count]` |
| `delete` | `path` | Removes a file, or a directory and its contents; refuses the `/memories` root |
| `rename` | `old_path`, `new_path` | Moves an entry; refuses an existing destination |

Every reply is the memory tool's own wording — including its failures, which are returned rather than thrown, because
the model reads the text to decide what to do next. Paths outside the memory root answer
`Path must start with /memories, got: <path>`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design concept

The store is a real directory, not a virtual filesystem: `/memories` is a vocabulary, and the configured directory is
what it means for one session. Two rules follow from that. First, the model's path never becomes a host path without
passing `resolveMemoryPath`, which refuses `..`, absolute paths, and drive-qualified paths, after which the nearest
existing ancestor's real path is checked against the root's, so a symlink planted inside the directory cannot
redirect a write outside it. Second, the tool answers with Claude's reply strings for both success and refusal: a
trained model's next call depends on that text, and an abortive error would replace it with the harness's rendering.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](../src/index.ts) | Plugin entry: settings namespace, tool, contributor, Remote owner |
| [`src/paths.ts`](../src/paths.ts) | `~` and `{project}` expansion, `/memories` resolution, display paths |
| [`src/store.ts`](../src/store.ts) | The six commands, index loading and caps, directory listing, containment checks |
| [`src/settings.ts`](../src/settings.ts) | `memory` namespace, composition config, project-name resolution |
| [`src/instructions.ts`](../src/instructions.ts) | Instruction text, message source, `agent/pre-step` folding |
| [`src/tool.ts`](../src/tool.ts) | `defineTool` definition, per-command argument validation, call card |
| [`src/remote.ts`](../src/remote.ts) | `memoryStore` Typert Remote: status, index read, index write |
| [`src/typert.ts`](../src/typert.ts) | The browser half's hand-written Remote contribution |
| [`src/client/`](../src/client) | Settings section, controller, dictionaries, styles |
| — | No runtime invariant companion is published; this package owns no independent event sequence or mutable relation beyond the tool registry, the Session log, and the memory directory itself. |

### Injection timing

The contributor listens on `agent/pre-step`, takes the decision `next()` returns, and folds one `instructions` message
after the last admitted user message of the first step that carries one. The message is recorded under the generic
`plugin` message source (`@zhang-guo-wen/dsh-memory#memory-index`), so a Session that already holds it — resumed, or
continued after the plugin was mounted — is left alone, and the Session format keeps only the source kinds a released
distribution produces.

### Where the settings page reads from

The settings section is not session-scoped, so `memoryStore.status` reports the directory the *host process's* project
resolves to and carries `configured` (the raw template) and `projectScoped` beside it. Writing the index from the page
goes through the same store the model writes through, so both paths share one 1 MiB cap and one final newline.

### The project dropdown (`src/targets.ts`)

`memoryStore.targets` lists the stores a deployment can show: the current project (the host process's cwd), every
`ctx.workspaceRegistry.list()` workspace, and — in Claude-directory mode — every project directory under
`<claude home>/projects/`. Rows are deduplicated by resolved directory with the current project first. `status`,
`readIndex`, and `writeIndex` all take a `target` id (`current`, `workspace:<id>`, or `claude:<slug>`); an unknown id
falls back to the current project and the id actually used rides back on `status.target`, so a stale selection never
fails the page.

</details>

-----

<a id="model-experience"></a>
## Model Experience

### The `memory` tool

#### What the model sees

One tool named `memory` with nine optional fields and a required `command` enum of six verbs. Each reply is the memory
tool's documented sentence for that outcome, for example `File created successfully at: /memories/notes.md`,
`Error: File /memories/notes.md already exists`, or
`No replacement was performed. Multiple occurrences of old_str \`x\` in lines: 2, 5. Please ensure it is unique`.

#### Token effect

The tool schema is part of every request: about 250 tokens. A call's reply is one sentence plus, for `view`, the
numbered content it asked for — bounded by the file itself (`view` reports files over the 999,999-line ceiling instead
of printing them, and the store refuses files over `maxFileBytes`).

#### KV Cache effect

The tool schema is stable across requests. Replies append to the transcript like any tool result; nothing re-renders
earlier content.

### Memory instructions

#### What the model sees

One `instructions`-form user message in the first request of a Session under the loader
`@zhang-guo-wen/dsh-memory#memory-index`: the memory protocol (directory path, one-file-per-memory frontmatter, the
two-step save, the four memory types, absolute dates) followed by `## Memory index` and the loaded `MEMORY.md`.

#### Token effect

The protocol prose is roughly 450 tokens; the index adds at most `indexLines` lines and `indexBytes` bytes (default
200 lines / 25 KB, as Claude loads it). A truncated index says so in one line.

#### KV Cache effect

The message folds once per Session and never changes afterwards, so it stays inside the reusable request prefix. The
model's own writes reach the store, not the transcript: a memory saved mid-session does not rewrite the prefix.

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

These are current package constraints, not a task backlog.

- **No frontmatter `modified` stamp.** Claude Code adds an ISO-8601 timestamp when it writes a memory file through its
  ordinary file tools. This store writes exactly the text it was given, so a file's own frontmatter is never rewritten.
- **One store per configured directory.** Per-session or per-workspace stores beyond the `{project}` token would need a
  settings field the settings page cannot express (the namespace is host-wide).
- **The settings page cannot create a directory.** The in-app browser lists and selects; creating a folder is the OS
  chooser's job, and a manual path in the field works everywhere.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The reply strings, the `/memories` prefix, the command set, and the index rules were taken from Anthropic's memory-tool
documentation and the Claude Code memory pages; the tool's own `description` is not published by Anthropic, so the
description here is written for this harness rather than copied.

</details>

**Runtime invariant:** No companion is published. The store's contract is its reply text and its containment rule, both
covered by `tests/store.spec.ts` and `tests/loader-composition.spec.ts`; there is no second independently observable
relation to assert at runtime.
