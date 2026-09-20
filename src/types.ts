/**
 * Client-safe request and result types for the `memoryStore` Remote namespace,
 * plus the failure codes its Host owner throws.
 *
 * The settings page is not session-scoped, so the directory it reports is the
 * one the Host process's own working directory resolves to; `configured` always
 * carries the raw template the user set.
 *
 * @module @zhang-guo-wen/dsh-memory/types
 */

/** Request for the memory store's current state. */
export interface MemoryStatusRequest {
  /** Selection id from {@link MemoryTargetsResult}; absent means the host process's own project. */
  readonly target?: string
}

/** One project the settings page can look at. */
export interface MemoryTargetView {
  /** Stable selection id, meaningful only to this plugin. */
  readonly id: string
  /** Human name: a workspace title, the directory's last segment, or a Claude project slug. */
  readonly label: string
  /** What the name refers to: the project directory, or Claude's project directory. */
  readonly detail: string
  /** Absolute memory directory this project resolves to. */
  readonly directory: string
  /** Whether that directory exists yet. */
  readonly exists: boolean
}

/** Request for the selectable projects. */
export interface MemoryTargetsRequest {
  /** Placeholder field: the list is host-wide, so the request carries none. */
  readonly unused?: boolean
}

/** The selectable projects, nearest first. */
export interface MemoryTargetsResult {
  /** The host process's own project, then every workspace, then Claude's project directories. */
  readonly targets: readonly MemoryTargetView[]
}

/** One memory file as the settings page lists it. */
export interface MemoryFileView {
  /** Model-facing path under `/memories`. */
  readonly path: string
  /** UTF-8 bytes on disk. */
  readonly bytes: number
  /** Last modification time in epoch milliseconds. */
  readonly modifiedMs: number
}

/** The index file's state, as the settings page shows it. */
export interface MemoryIndexView {
  /** Model-facing path of the index file. */
  readonly path: string
  /** UTF-8 bytes of the whole file on disk. */
  readonly bytes: number
  /** Lines of the whole file on disk. */
  readonly lines: number
  /** Lines a session loads. */
  readonly limitLines: number
  /** UTF-8 bytes a session loads. */
  readonly limitBytes: number
  /** Whether the load limits cut the file. */
  readonly truncated: boolean
}

/** The memory store's current state. */
export interface MemoryStatusResult {
  /** Whether the memory feature is on. */
  readonly enabled: boolean
  /** Whether the store is Claude Code's own memory directory. */
  readonly claudeCompatible: boolean
  /** Selection id this report describes, after falling back from an unknown one. */
  readonly target: string
  /** The directory exactly as configured, `~` and `{project}` included. */
  readonly configured: string
  /** The configured directory resolved for the host process's project. */
  readonly directory: string
  /** Whether the configured directory still carries the `{project}` token. */
  readonly projectScoped: boolean
  /** Whether the resolved directory exists. */
  readonly exists: boolean
  /** The index file's state, or null when there is none. */
  readonly index: MemoryIndexView | null
  /** Every file in the directory, in name order. */
  readonly files: readonly MemoryFileView[]
  /** Sum of the listed files' sizes. */
  readonly totalBytes: number
  /** Largest single file the Host reads or writes. */
  readonly maxFileBytes: number
}

/** Request for the index file's current content. */
export interface MemoryReadIndexRequest {
  /** Selection id from {@link MemoryTargetsResult}; absent means the host process's own project. */
  readonly target?: string
}

/** The index file's current content. */
export interface MemoryReadIndexResult {
  /** Whether the index file exists. */
  readonly exists: boolean
  /** Whole file content; empty when the file does not exist. */
  readonly content: string
  /** UTF-8 bytes of the whole file on disk. */
  readonly bytes: number
}

/** Request to replace the index file's content. */
export interface MemoryWriteIndexRequest {
  /** Selection id from {@link MemoryTargetsResult}; absent means the host process's own project. */
  readonly target?: string
  /** The index file's new content. */
  readonly content: string
}

/** The index file's state after a write. */
export interface MemoryWriteIndexResult {
  /** UTF-8 bytes written. */
  readonly bytes: number
  /** Lines written. */
  readonly lines: number
}

/** Failure details owned by the memory-store Remote. */
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The request or the configured directory is unusable. */
    'memory/invalid': { readonly reason: string }
    /** The memory directory could not be read or written. */
    'memory/io': { readonly reason: string }
  }
}
