/**
 * The memory store: Claude's memory-tool commands over a real directory.
 *
 * The directory holds what Claude's auto memory holds — an index file named
 * `MEMORY.md` plus one topic file per memory — and the tool's commands keep
 * Claude's addressing (`/memories/...`), its command set
 * (`view`, `create`, `str_replace`, `insert`, `delete`, `rename`), and its
 * reply strings, because a model trained against that tool reads the reply to
 * decide what to do next. A refusal is therefore a returned reply, not a
 * thrown error: the text is the contract.
 *
 * Every path is resolved through {@link resolveMemoryPath} and then checked
 * against the real path of the root, so a symlink planted inside the directory
 * cannot redirect a write outside it.
 *
 * @module @guowenzhang/dsh-memory/store
 */

import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { MemoryPathError, memoryDisplayPath, resolveMemoryPath } from './paths.ts'

/** The index file's name inside the memory directory. */
export const MEMORY_INDEX_NAME = 'MEMORY.md'

/** Lines of the index loaded into a session, matching Claude Code. */
export const DEFAULT_INDEX_LINES = 200

/** UTF-8 bytes of the index loaded into a session, matching Claude Code. */
export const DEFAULT_INDEX_BYTES = 25_600

/** Lines a `view` of one file reports, matching the memory tool's ceiling. */
export const MAX_VIEW_LINES = 999_999

/** Directory levels a `view` of a directory lists, matching the memory tool. */
export const VIEW_DIRECTORY_DEPTH = 2

/** Names never listed by a directory `view`, matching the memory tool. */
const HIDDEN_DIRECTORY_NAMES = new Set(['node_modules'])

/** Caps one store applies to every file it reads or writes. */
export interface MemoryLimits {
  /** Largest single file this store reads or writes, in UTF-8 bytes. */
  readonly maxFileBytes: number
}

/** Default {@link MemoryLimits}. */
export const DEFAULT_MEMORY_LIMITS: MemoryLimits = { maxFileBytes: 1_048_576 }

/** The index as one session loads it. */
export interface MemoryIndex {
  /** Index text, already cut to the line and byte limits. */
  readonly content: string
  /** UTF-8 bytes of the whole file on disk. */
  readonly bytes: number
  /** Lines of the whole file on disk. */
  readonly lines: number
  /** Whether the limits cut the file. */
  readonly truncated: boolean
}

/** One file in the memory directory, for the settings page. */
export interface MemoryFileRow {
  /** Model-facing path under `/memories`. */
  readonly path: string
  /** UTF-8 bytes on disk. */
  readonly bytes: number
  /** Last modification time in epoch milliseconds. */
  readonly modifiedMs: number
}

/** One row of a directory `view`. */
interface ListingRow {
  readonly display: string
  readonly bytes: number
}

/** A `view` request's optional line window. */
export type ViewRange = readonly [number, number]

/**
 * One session's memory directory, addressed by Claude's memory-tool commands.
 */
export class MemoryStore {
  /** Absolute memory directory. */
  readonly root: string

  private readonly limits: MemoryLimits

  /**
   * @param root - absolute memory directory (created by the first write).
   * @param limits - byte caps applied to every file this store touches.
   */
  constructor(root: string, limits: MemoryLimits = DEFAULT_MEMORY_LIMITS) {
    this.root = root
    this.limits = limits
  }

  /**
   * Read the index file whole, as the settings page shows it.
   * @returns the file's content, UTF-8 bytes, and line count, or `undefined` when there is no index file.
   */
  async readIndexSource(): Promise<{ content: string; bytes: number; lines: number } | undefined> {
    const path = join(this.root, MEMORY_INDEX_NAME)
    const info = await statOrUndefined(path)
    if (info === undefined || !info.isFile()) return undefined
    if (info.size > this.limits.maxFileBytes) return undefined
    const content = await readFile(path, { encoding: 'utf8' })
    return { content, bytes: Buffer.byteLength(content, 'utf8'), lines: countLines(content) }
  }

  /**
   * Replace the index file's content, creating the directory when needed.
   * @param content - the index file's new content.
   * @returns the UTF-8 bytes and lines written.
   * @throws Error when the content outgrows the store's file cap.
   */
  async writeIndex(content: string): Promise<{ bytes: number; lines: number }> {
    const bytes = Buffer.byteLength(content, 'utf8')
    if (bytes > this.limits.maxFileBytes) {
      throw new Error(
        `${memoryDisplayPath(this.root, join(this.root, MEMORY_INDEX_NAME))} is larger than this memory store's ${this.limits.maxFileBytes}-byte file limit`,
      )
    }
    await mkdir(this.root, { recursive: true })
    await writeFile(join(this.root, MEMORY_INDEX_NAME), content, { encoding: 'utf8' })
    return { bytes, lines: countLines(content) }
  }

  /**
   * Read the index as a session loads it: the first `indexLines` lines or the
   * first `indexBytes` UTF-8 bytes, whichever ends first.
   * @param indexLines - line cap; defaults to {@link DEFAULT_INDEX_LINES}.
   * @param indexBytes - byte cap; defaults to {@link DEFAULT_INDEX_BYTES}.
   * @returns the loaded index, or `undefined` when the directory has no index file.
   */
  async readIndex(
    indexLines: number = DEFAULT_INDEX_LINES,
    indexBytes: number = DEFAULT_INDEX_BYTES,
  ): Promise<MemoryIndex | undefined> {
    const source = await this.readIndexSource()
    if (source === undefined) return undefined
    const byBytes = truncateToBytes(source.content, indexBytes)
    const byLines = firstLines(byBytes, indexLines)
    return {
      content: byLines,
      bytes: source.bytes,
      lines: source.lines,
      truncated: byLines.length !== source.content.length,
    }
  }

  /**
   * List every file in the memory directory, for the settings page.
   * @param maxDepth - how many directory levels below the root to walk.
   * @returns the files in name order, with their sizes and modification times.
   */
  async listFiles(maxDepth = 3): Promise<MemoryFileRow[]> {
    const rows: MemoryFileRow[] = []
    await this.walk(this.root, maxDepth, rows)
    return rows.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
  }

  /**
   * Answer a `view` command for one file or directory.
   * @param requested - the model-supplied path under `/memories`.
   * @param viewRange - optional 1-based inclusive line window for a file; `-1` as the end means end of file.
   * @returns the listing or line-numbered content, or the reply text for a missing path.
   * @throws MemoryPathError when the path addresses a location outside the memory root.
   */
  async view(requested: string, viewRange?: ViewRange): Promise<string> {
    const target = await this.resolveChecked(requested)
    const info = await statOrUndefined(target.absolute)
    if (info === undefined) return missingPath(target.display)
    if (info.isDirectory()) return await this.renderDirectory(target.display, target.absolute)
    if (!info.isFile()) return missingPath(target.display)
    if (info.size > this.limits.maxFileBytes) return oversized(target.display, this.limits.maxFileBytes)
    const text = await readFile(target.absolute, { encoding: 'utf8' })
    return renderFileView(target.display, text, viewRange)
  }

  /**
   * Answer a `create` command: write a new file, refusing an existing one.
   * @param requested - the model-supplied path under `/memories`.
   * @param fileText - the file's full content.
   * @returns the reply text.
   * @throws MemoryPathError when the path addresses a location outside the memory root.
   */
  async create(requested: string, fileText: string): Promise<string> {
    const target = await this.resolveChecked(requested)
    if (await statOrUndefined(target.absolute) !== undefined) return alreadyExists(target.display)
    const bytes = Buffer.byteLength(fileText, 'utf8')
    if (bytes > this.limits.maxFileBytes) return oversized(target.display, this.limits.maxFileBytes)
    await mkdir(dirname(target.absolute), { recursive: true })
    try {
      await writeFile(target.absolute, fileText, { encoding: 'utf8', flag: 'wx' })
    } catch (error: unknown) {
      if (isErrnoCode(error, 'EEXIST')) return alreadyExists(target.display)
      throw error
    }
    return `File created successfully at: ${target.display}`
  }

  /**
   * Answer a `str_replace` command: replace one uniquely occurring string.
   * @param requested - the model-supplied path under `/memories`.
   * @param oldStr - text that must occur exactly once.
   * @param newStr - replacement text; an empty string deletes `oldStr`.
   * @returns the reply text, including a line-numbered window around the edit.
   * @throws MemoryPathError when the path addresses a location outside the memory root.
   */
  async strReplace(requested: string, oldStr: string, newStr: string): Promise<string> {
    const target = await this.resolveChecked(requested)
    const read = await this.readEditable(target.absolute, target.display)
    if ('reply' in read) return read.reply
    const current = read.content
    const occurrences = countOccurrences(current, oldStr)
    if (occurrences === 0) {
      return `No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${target.display}.`
    }
    if (occurrences > 1) {
      const lines = occurrenceLines(current, oldStr).join(', ')
      return `No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: ${lines}. Please ensure it is unique`
    }
    const index = current.indexOf(oldStr)
    const updated = `${current.slice(0, index)}${newStr}${current.slice(index + oldStr.length)}`
    await this.write(target.absolute, updated, target.display)
    const changedLine = countLines(current.slice(0, index)) + 1
    return `The memory file has been edited.\n${renderWindow(target.display, updated, changedLine - 3, newStr)}`
  }

  /**
   * Answer an `insert` command: insert text at a 0-based line index.
   * @param requested - the model-supplied path under `/memories`.
   * @param insertLine - 0-based insertion index in `[0, line count]`.
   * @param insertText - text to insert.
   * @returns the reply text.
   * @throws MemoryPathError when the path addresses a location outside the memory root.
   */
  async insert(requested: string, insertLine: number, insertText: string): Promise<string> {
    const target = await this.resolveChecked(requested)
    const read = await this.readEditable(target.absolute, target.display)
    if ('reply' in read) return read.reply
    const lines = splitLines(read.content)
    if (!Number.isInteger(insertLine) || insertLine < 0 || insertLine > lines.length) {
      return `Error: Invalid \`insert_line\` parameter: ${insertLine}. It should be within the range of lines of the file: [0, ${lines.length}]`
    }
    const inserted = insertText.split('\n')
    if (inserted[inserted.length - 1] === '') inserted.pop()
    const updated = [...lines.slice(0, insertLine), ...inserted, ...lines.slice(insertLine)].join('\n')
    await this.write(target.absolute, updated, target.display)
    return `The file ${target.display} has been edited.`
  }

  /**
   * Answer a `delete` command: remove a file or a directory tree.
   * @param requested - the model-supplied path under `/memories`.
   * @returns the reply text.
   * @throws MemoryPathError when the path addresses a location outside the memory root.
   */
  async delete(requested: string): Promise<string> {
    const target = await this.resolveChecked(requested)
    if (target.absolute === this.root) return `Cannot delete the ${memoryDisplayPath(this.root, this.root)} directory itself`
    if (await statOrUndefined(target.absolute) === undefined) return missingPath(target.display)
    await rm(target.absolute, { recursive: true, force: true })
    return `Successfully deleted ${target.display}`
  }

  /**
   * Answer a `rename` command: move a file or directory, refusing to overwrite.
   * @param requested - the model-supplied source path under `/memories`.
   * @param destination - the model-supplied destination path under `/memories`.
   * @returns the reply text.
   * @throws MemoryPathError when either path addresses a location outside the memory root.
   */
  async rename(requested: string, destination: string): Promise<string> {
    const source = await this.resolveChecked(requested)
    const target = await this.resolveChecked(destination)
    if (await statOrUndefined(source.absolute) === undefined) {
      return `Error: The path ${source.display} does not exist`
    }
    if (await statOrUndefined(target.absolute) !== undefined) {
      return `Error: The destination ${target.display} already exists`
    }
    await mkdir(dirname(target.absolute), { recursive: true })
    await rename(source.absolute, target.absolute)
    return `Successfully renamed ${source.display} to ${target.display}`
  }

  /** Resolve one model path and refuse one that escapes the root's real path. */
  private async resolveChecked(requested: string): Promise<{ absolute: string; display: string }> {
    const absolute = resolveMemoryPath(this.root, requested)
    const display = memoryDisplayPath(this.root, absolute)
    const rootReal = await realpathOrUndefined(this.root)
    // A root that does not exist yet cannot contain a symlink to follow.
    if (rootReal === undefined) return { absolute, display }
    const existingReal = await realpathOrUndefined(await nearestExisting(absolute, this.root))
    if (existingReal === undefined) return { absolute, display }
    const inside = relative(rootReal, existingReal)
    if (inside.startsWith('..') || isAbsolute(inside)) throw new MemoryPathError(display)
    return { absolute, display }
  }

  /** Read a file the model intends to edit, or the reply text explaining why not. */
  private async readEditable(absolute: string, display: string): Promise<{ content: string } | { reply: string }> {
    const info = await statOrUndefined(absolute)
    if (info === undefined || !info.isFile()) return { reply: missingPath(display) }
    if (info.size > this.limits.maxFileBytes) return { reply: oversized(display, this.limits.maxFileBytes) }
    return { content: await readFile(absolute, { encoding: 'utf8' }) }
  }

  /** Write one edited file, refusing content that outgrows the store's cap. */
  private async write(absolute: string, text: string, display: string): Promise<void> {
    if (Buffer.byteLength(text, 'utf8') > this.limits.maxFileBytes) {
      throw new Error(oversized(display, this.limits.maxFileBytes))
    }
    await writeFile(absolute, text, { encoding: 'utf8' })
  }

  /** Render one directory level (and its children) as the `view` listing. */
  private async renderDirectory(display: string, absolute: string): Promise<string> {
    const rows: ListingRow[] = []
    await this.collect(absolute, display, VIEW_DIRECTORY_DEPTH, rows)
    const header = `Here're the files and directories up to ${VIEW_DIRECTORY_DEPTH} levels deep in ${display}, excluding hidden items:`
    if (rows.length === 0) return `${header}\n(empty)`
    return `${header}\n${rows.map(row => `${formatSize(row.bytes)}\t${row.display}`).join('\n')}`
  }

  /** Collect one directory level and, while depth remains, its children. */
  private async collect(absolute: string, display: string, depth: number, rows: ListingRow[]): Promise<void> {
    if (depth <= 0) return
    for (const entry of await readdirOrEmpty(absolute)) {
      if (entry.name.startsWith('.') || HIDDEN_DIRECTORY_NAMES.has(entry.name)) continue
      const child = join(absolute, entry.name)
      const childDisplay = `${display === '/' ? '' : display}/${entry.name}`
      const info = await statOrUndefined(child)
      if (info === undefined) continue
      rows.push({ display: childDisplay, bytes: info.isDirectory() ? await sumBytes(child, depth - 1) : info.size })
      if (info.isDirectory()) await this.collect(child, childDisplay, depth - 1, rows)
    }
  }

  /** Walk the memory directory for the settings page's file list. */
  private async walk(absolute: string, depth: number, rows: MemoryFileRow[]): Promise<void> {
    if (depth < 0) return
    for (const entry of await readdirOrEmpty(absolute)) {
      if (entry.name.startsWith('.')) continue
      const child = join(absolute, entry.name)
      const info = await statOrUndefined(child)
      if (info === undefined) continue
      if (info.isDirectory()) {
        await this.walk(child, depth - 1, rows)
        continue
      }
      if (!info.isFile()) continue
      rows.push({
        path: memoryDisplayPath(this.root, child),
        bytes: info.size,
        modifiedMs: info.mtimeMs,
      })
    }
  }
}

/** Reply text for a path that names nothing. */
function missingPath(display: string): string {
  return `Error: The path ${display} does not exist. Please provide a valid path.`
}

/** Reply text for a file that outgrows the store's cap. */
function oversized(display: string, maxFileBytes: number): string {
  return `Error: ${display} is larger than this memory store's ${maxFileBytes}-byte file limit.`
}

/** Reply text for a `create` over an existing entry. */
function alreadyExists(display: string): string {
  return `Error: File ${display} already exists`
}

/** Render a file as Claude's line-numbered `view` content. */
function renderFileView(display: string, text: string, viewRange?: ViewRange): string {
  const lines = splitLines(text)
  if (lines.length > MAX_VIEW_LINES) {
    return `File ${display} exceeds maximum line limit of ${MAX_VIEW_LINES.toLocaleString('en-US')} lines.`
  }
  const [first, last] = viewRange === undefined
    ? [1, lines.length]
    : [viewRange[0], viewRange[1] === -1 ? lines.length : viewRange[1]]
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || first > lines.length) {
    return `Error: Invalid \`view_range\` parameter: [${viewRange?.[0]}, ${viewRange?.[1]}]. It should be within the range of lines of the file: [1, ${lines.length}]`
  }
  const window = lines.slice(first - 1, Math.min(last, lines.length))
  return `Here's the content of ${display} with line numbers:\n${numberLines(window, first)}`
}

/** Render a line-numbered window around one edit, clamped to the file. */
function renderWindow(display: string, text: string, from: number, inserted: string): string {
  const lines = splitLines(text)
  const first = Math.max(1, from)
  const last = Math.min(lines.length, first + 6 + inserted.split('\n').length)
  return `${numberLines(lines.slice(first - 1, last), first)}`
}

/** Number lines the way the memory tool does: six columns, right-aligned, tab-separated. */
function numberLines(lines: readonly string[], firstNumber: number): string {
  return lines
    .map((line, offset) => `${String(firstNumber + offset).padStart(6, ' ')}\t${line}`)
    .join('\n')
}

/** Split text into lines the way an insertion index counts them. */
function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** Count the lines a text occupies, matching {@link splitLines}. */
function countLines(text: string): number {
  return splitLines(text).length
}

/** Cut a text to its first `limit` lines. */
function firstLines(text: string, limit: number): string {
  if (limit <= 0) return ''
  const lines = text.split('\n')
  if (lines.length <= limit) return text
  return lines.slice(0, limit).join('\n')
}

/** Cut a text to at most `limit` UTF-8 bytes without splitting a character. */
function truncateToBytes(text: string, limit: number): string {
  const encoded = Buffer.from(text, 'utf8')
  if (encoded.length <= limit) return text
  return new TextDecoder('utf-8', { fatal: false }).decode(encoded.subarray(0, limit)).replace(/\uFFFD$/u, '')
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

/** The 1-based line numbers where `needle` occurs. */
function occurrenceLines(haystack: string, needle: string): number[] {
  const lines: number[] = []
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    lines.push(countLines(haystack.slice(0, index)) + 1)
    index = haystack.indexOf(needle, index + needle.length)
  }
  return lines
}

/** Human-readable byte size, as a directory listing shows it. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

/** Recursive byte total of one directory, bounded by `depth`. */
async function sumBytes(absolute: string, depth: number): Promise<number> {
  if (depth < 0) return 0
  let total = 0
  for (const entry of await readdirOrEmpty(absolute)) {
    if (entry.name.startsWith('.') || HIDDEN_DIRECTORY_NAMES.has(entry.name)) continue
    const child = join(absolute, entry.name)
    const info = await statOrUndefined(child)
    if (info === undefined) continue
    total += info.isDirectory() ? await sumBytes(child, depth - 1) : info.size
  }
  return total
}

/** The nearest existing path at or below `stop`, starting from `target`. */
async function nearestExisting(target: string, stop: string): Promise<string> {
  let current = target
  for (;;) {
    if (await statOrUndefined(current) !== undefined) return current
    if (current === stop) return stop
    const parent = dirname(current)
    if (parent === current) return stop
    current = parent
  }
}

async function statOrUndefined(path: string) {
  try {
    return await stat(path)
  } catch {
    return undefined
  }
}

async function realpathOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await realpath(path)
  } catch {
    return undefined
  }
}

async function readdirOrEmpty(path: string) {
  try {
    return await readdir(path, { withFileTypes: true })
  } catch {
    return []
  }
}

function isErrnoCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code
}
