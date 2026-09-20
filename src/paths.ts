/**
 * Memory-directory resolution and the `/memories` path vocabulary.
 *
 * Claude's memory tool addresses every file through one virtual root,
 * `/memories`, and refuses anything outside it. This plugin keeps that
 * vocabulary while the user owns the real directory: the configured path (with
 * `~` and an optional `{project}` token expanded) is what `/memories` means for
 * a session. Every model-supplied path is resolved through
 * {@link resolveMemoryPath}, which answers the requested text on refusal so the
 * tool can report Claude's own error string.
 *
 * @module @zhang-guo-wen/dsh-memory/paths
 */

import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'

/** Memory directory used when the user configures none: one subdirectory per project. */
export const DEFAULT_MEMORY_DIRECTORY = '~/.dsh/memory/{project}'

/** Virtual root every model-facing memory path is addressed through. */
export const MEMORY_PATH_PREFIX = '/memories'

/** Token in a configured directory replaced by the session project's directory name. */
export const PROJECT_TOKEN = '{project}'

/** A model-supplied path that does not address a location inside the memory root. */
export class MemoryPathError extends Error {
  /** The path exactly as the model supplied it. */
  readonly requested: string

  /**
   * @param requested - the model-supplied path text.
   */
  constructor(requested: string) {
    super(`Path must start with ${MEMORY_PATH_PREFIX}, got: ${requested}`)
    this.name = 'MemoryPathError'
    this.requested = requested
  }
}

/**
 * Expand a leading `~` against the process user home.
 * @param configured - a configured directory, possibly starting with `~`.
 * @returns the same path with `~` replaced by the user home.
 */
export function expandHome(configured: string): string {
  if (configured === '~') return homedir()
  if (configured.startsWith('~/') || configured.startsWith('~\\')) return join(homedir(), configured.slice(2))
  return configured
}

/**
 * Resolve the configured memory directory to an absolute path.
 * @param configured - configured directory; blank uses {@link DEFAULT_MEMORY_DIRECTORY}.
 * @param projectName - Claude-style project directory name substituted for {@link PROJECT_TOKEN}.
 * @returns the absolute memory directory (which need not exist).
 */
export function resolveMemoryDirectory(configured: string, projectName: string): string {
  const trimmed = configured.trim()
  const expanded = expandHome(trimmed === '' ? DEFAULT_MEMORY_DIRECTORY : trimmed)
  return resolve(expanded.split(PROJECT_TOKEN).join(projectName))
}

/**
 * Convert a model-facing path into an absolute host path inside the memory root.
 *
 * Accepted forms are `/memories`, `/memories/<relative>`, and the same relative
 * text with or without that prefix; backslashes are accepted as separators. An
 * absolute path outside the root, a `..` segment, or a drive-qualified path is
 * refused.
 * @param root - absolute memory directory.
 * @param requested - the model-supplied path.
 * @returns the absolute path inside `root`.
 * @throws MemoryPathError when the path does not address a location inside `root`.
 */
export function resolveMemoryPath(root: string, requested: string): string {
  const normalized = requested.trim().replace(/\\/g, '/')
  let relativeText = normalized
  if (relativeText === MEMORY_PATH_PREFIX || relativeText === 'memories') relativeText = ''
  else if (relativeText.startsWith(`${MEMORY_PATH_PREFIX}/`)) {
    relativeText = relativeText.slice(MEMORY_PATH_PREFIX.length + 1)
  } else if (relativeText.startsWith('memories/')) relativeText = relativeText.slice('memories/'.length)
  if (relativeText.startsWith('/') || /^[A-Za-z]:/.test(relativeText)) throw new MemoryPathError(requested)
  const segments = relativeText.split('/').filter(segment => segment !== '' && segment !== '.')
  if (segments.some(segment => segment === '..')) throw new MemoryPathError(requested)
  const absolute = resolve(root, ...segments)
  const inside = relative(root, absolute)
  if (inside.startsWith('..') || isAbsolute(inside)) throw new MemoryPathError(requested)
  return absolute
}

/**
 * Render an absolute path inside the memory root as the model-facing path.
 * @param root - absolute memory directory.
 * @param absolute - absolute path inside `root`.
 * @returns the `/memories`-prefixed path with forward slashes.
 */
export function memoryDisplayPath(root: string, absolute: string): string {
  const inside = relative(root, absolute).replace(/\\/g, '/')
  return inside === '' ? MEMORY_PATH_PREFIX : `${MEMORY_PATH_PREFIX}/${inside}`
}

/**
 * Claude Code's project-directory name for a path: every character outside
 * `[A-Za-z0-9]` becomes `-` (`C:\src\app` becomes `C--src-app`), which is how
 * the directory under `<claude home>/projects` is named.
 * @param path - the absolute project root path.
 * @returns the directory name Claude Code uses.
 */
export function projectSlug(path: string): string {
  return path.replace(/[^A-Za-z0-9]/g, '-')
}
