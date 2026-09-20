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
  /** Placeholder field: the store is host-wide, so the request carries none. */
  readonly unused?: boolean
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
  /** Placeholder field: the store is host-wide, so the request carries none. */
  readonly unused?: boolean
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
