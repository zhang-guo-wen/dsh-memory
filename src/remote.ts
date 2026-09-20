/**
 * Host owner of the `memoryStore` Remote namespace: what the settings page
 * reads (the directory's state, the index's content) and the one thing it
 * writes (the index).
 *
 * The service is registered unconditionally: a guarded registration would make
 * every client call fail with a missing namespace instead of a reportable
 * error.
 *
 * @module @zhang-guo-wen/dsh-memory/remote
 */

import { stat } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { MEMORY_PATH_PREFIX, PROJECT_TOKEN } from './paths.ts'
import { MEMORY_INDEX_NAME, MemoryStore } from './store.ts'
import type { MemoryRuntime } from './settings.ts'
import type {
  MemoryIndexView,
  MemoryReadIndexRequest,
  MemoryReadIndexResult,
  MemoryStatusRequest,
  MemoryStatusResult,
  MemoryWriteIndexRequest,
  MemoryWriteIndexResult,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `memoryStore` Remote namespace. */
    memoryStore: MemoryRemote
  }
}

/**
 * Host service behind the `memoryStore` Remote namespace. Every method answers
 * for the memory store the Host process's own project resolves to, because the
 * settings page is not session-scoped; a `{project}`-templated directory says
 * so through `projectScoped`.
 */
export class MemoryRemote extends TypertRemoteService {
  /**
   * @param ctx - host context.
   * @param runtime - live settings and directory resolution.
   */
  constructor(ctx: Context, private readonly runtime: MemoryRuntime) {
    super(ctx, 'memoryStore')
  }

  /**
   * Report the memory directory's current state.
   * @param request - empty placeholder; the store is host-wide. The parameter
   *   must keep this name: the gateway derives its descriptor from the method
   *   signature and rejects a payload whose field does not match.
   * @returns the configured and resolved directory, the index's state, and every file.
   */
  @Remote('status')
  async status(request: MemoryStatusRequest): Promise<MemoryStatusResult> {
    void request
    const configured = this.runtime.configuredDirectory()
    const store = await this.store()
    const [indexSource, files, exists] = await Promise.all([
      store.readIndexSource(),
      store.listFiles(),
      existsAt(store.root),
    ])
    return {
      enabled: this.runtime.enabled(),
      configured,
      directory: store.root,
      projectScoped: configured.includes(PROJECT_TOKEN),
      exists,
      index: indexSource === undefined ? null : indexView(indexSource, this.runtime),
      files,
      totalBytes: files.reduce((total, file) => total + file.bytes, 0),
      maxFileBytes: this.runtime.maxFileBytes(),
    }
  }

  /**
   * Read the index file's whole content for the settings editor.
   * @param request - empty placeholder; the store is host-wide.
   * @returns whether the index exists, its content, and its size.
   * @throws a typed memory error when the file cannot be read.
   */
  @Remote('readIndex')
  async readIndex(request: MemoryReadIndexRequest): Promise<MemoryReadIndexResult> {
    void request
    const store = await this.store()
    try {
      const source = await store.readIndexSource()
      return source === undefined
        ? { exists: false, content: '', bytes: 0 }
        : { exists: true, content: source.content, bytes: source.bytes }
    } catch (cause) {
      throw ioFailure(`reading ${MEMORY_PATH_PREFIX}/${MEMORY_INDEX_NAME} failed`, cause)
    }
  }

  /**
   * Replace the index file's content.
   * @param request - the index file's new content.
   * @returns the bytes and lines written.
   * @throws a typed memory error when the content is not text or cannot be written.
   */
  @Remote('writeIndex')
  async writeIndex(request: MemoryWriteIndexRequest): Promise<MemoryWriteIndexResult> {
    if (typeof request.content !== 'string') {
      throw new RemoteError('memory/invalid', 'writeIndex requires a string `content`', {
        reason: `content was ${typeof request.content}`,
      })
    }
    const store = await this.store()
    try {
      return await store.writeIndex(request.content)
    } catch (cause) {
      throw ioFailure(`writing ${MEMORY_PATH_PREFIX}/${MEMORY_INDEX_NAME} failed`, cause)
    }
  }

  /** The store for the directory the Host process's own project resolves to. */
  private async store(): Promise<MemoryStore> {
    return new MemoryStore(
      await this.runtime.directoryFor(undefined),
      { maxFileBytes: this.runtime.maxFileBytes() },
    )
  }
}

/** The index view one status report carries. */
function indexView(
  source: { bytes: number; lines: number },
  runtime: MemoryRuntime,
): MemoryIndexView {
  const limitLines = runtime.indexLines()
  const limitBytes = runtime.indexBytes()
  return {
    path: `${MEMORY_PATH_PREFIX}/${MEMORY_INDEX_NAME}`,
    bytes: source.bytes,
    lines: source.lines,
    limitLines,
    limitBytes,
    truncated: source.lines > limitLines || source.bytes > limitBytes,
  }
}

/** Whether a path exists at all. */
async function existsAt(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Classify a settings-page store failure for the Remote caller. */
function ioFailure(message: string, cause: unknown): RemoteError<'memory/io'> {
  return new RemoteError('memory/io', message, { reason: reasonOf(cause) }, { cause })
}

function reasonOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
