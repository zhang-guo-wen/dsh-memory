/**
 * Memory settings: the user's memory directory and the on/off switch.
 *
 * One namespace (`memory`) owns both fields, so the settings page and the Host
 * behavior share one value. Values resolve through `ctx.settings` when the
 * settings service is mounted and fall back to the composition `base`
 * otherwise; the settings service is read through a small local interface so
 * this package stays composable in trees that do not mount it.
 *
 * @module @zhang-guo-wen/dsh-memory/settings
 */

import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import {
  DEFAULT_MEMORY_DIRECTORY,
  projectSlug,
  resolveMemoryDirectory,
} from './paths.ts'
import { DEFAULT_INDEX_BYTES, DEFAULT_INDEX_LINES, DEFAULT_MEMORY_LIMITS } from './store.ts'

/** Settings namespace owned by this plugin. */
export const MEMORY_SETTINGS_NAMESPACE = 'memory'

/** Every field the memory settings page writes. */
export interface MemorySettingsFlags {
  /** Whether the memory directory is injected into a session and exposed as a tool. */
  enabled: boolean
  /**
   * Memory directory. `~` expands to the user home, and `{project}` is
   * replaced by the session project's Claude-style directory name.
   */
  directory: string
  /**
   * Whether the store is Claude Code's own auto-memory directory
   * (`<claude home>/projects/<project>/memory`). While it is on, `directory` is
   * ignored and no directory has to be chosen.
   */
  claudeCompatible: boolean
}

/** Schema served to settings clients for this namespace. */
export const MEMORY_SETTINGS_SCHEMA: Schema<MemorySettingsFlags> = z.object({
  enabled: z.boolean().default(true),
  directory: z.string().default(DEFAULT_MEMORY_DIRECTORY),
  claudeCompatible: z.boolean().default(false),
})

/** Composition-layer defaults and caps for this plugin. */
export interface MemoryConfig {
  /** Initial on/off state when the user document does not override it. Defaults to true. */
  enabled?: boolean
  /** Initial memory directory when the user document does not override it. */
  directory?: string
  /** Initial Claude-directory mode when the user document does not override it. Defaults to false. */
  claudeCompatible?: boolean
  /** Claude Code config directory; defaults to `$CLAUDE_CONFIG_DIR`, then `$CLAUDE_HOME`, then `~/.claude`. */
  claudeHome?: string
  /** Lines of the index a session loads. Defaults to 200, matching Claude Code. */
  indexLines?: number
  /** UTF-8 bytes of the index a session loads. Defaults to 25600, matching Claude Code. */
  indexBytes?: number
  /** Largest single memory file this plugin reads or writes. Defaults to 1 MiB. */
  maxFileBytes?: number
  /** Directory entries that identify the project root while walking upward. Defaults to `['.git']`. */
  projectRootMarkers?: string[]
}

/** What the tool and the contributor read at request time. */
export interface MemoryRuntime {
  /** Whether memory is on right now. */
  enabled(): boolean
  /** Whether the store is Claude Code's own memory directory right now. */
  claudeCompatible(): boolean
  /** The configured directory, as the settings page shows it. */
  configuredDirectory(): string
  /** Resolve the memory directory for one session working directory. */
  directoryFor(cwd: string | undefined): Promise<string>
  /** Lines of the index a session loads. */
  indexLines(): number
  /** UTF-8 bytes of the index a session loads. */
  indexBytes(): number
  /** Largest single memory file this plugin reads or writes. */
  maxFileBytes(): number
}

/** Minimal local shape of the `settings.register` owner scope this plugin consumes. */
interface SettingsScopeLike<T> {
  get(): T
  watch(callback: (next: T, prev: T) => void): () => void
}

interface SettingsRegisterOptionsLike<T> {
  base?: Partial<T>
  applies?: 'live' | 'restart'
}

interface SettingsProviderLike {
  register<T>(
    namespace: string,
    schema: unknown,
    options?: SettingsRegisterOptionsLike<T>,
  ): SettingsScopeLike<T>
}

/**
 * Register the `memory` namespace and return the runtime the tool and the
 * contributor read.
 *
 * Without a mounted settings service the runtime stays pinned to the
 * composition defaults. A namespace already owned by another plugin keeps that
 * owner's value — this plugin never throws.
 * @param ctx - plugin context (uses `ctx.get('settings')`-equivalent injection when present).
 * @param config - composition defaults and caps.
 * @param onCommitted - observer invoked after each committed change, so a live
 *   registration can follow the switch.
 * @returns the live runtime.
 */
export function registerMemorySettings(
  ctx: Context,
  config: MemoryConfig = {},
  onCommitted?: (flags: MemorySettingsFlags) => void,
): MemoryRuntime {
  const base: MemorySettingsFlags = {
    enabled: config.enabled ?? true,
    directory: config.directory ?? DEFAULT_MEMORY_DIRECTORY,
    claudeCompatible: config.claudeCompatible ?? false,
  }
  let flags = (): MemorySettingsFlags => ({ ...base })
  ctx.inject(['settings'], (settingsCtx) => {
    const provider = (settingsCtx as unknown as { settings: SettingsProviderLike }).settings
    try {
      const scope = provider.register<MemorySettingsFlags>(
        MEMORY_SETTINGS_NAMESPACE,
        MEMORY_SETTINGS_SCHEMA,
        { base, applies: 'live' },
      )
      flags = () => ({ ...scope.get() })
      scope.watch((next) => {
        flags = () => ({ ...next })
        onCommitted?.({ ...next })
      })
    } catch {
      // Another owner already registered this namespace; keep the base.
    }
  })

  const markers = config.projectRootMarkers ?? ['.git']
  const claudeHome = resolveClaudeHome(config)
  const names = new Map<string, Promise<string>>()

  const projectNameFor = async (cwd: string | undefined): Promise<string> => {
    const start = resolve(cwd ?? process.cwd())
    const cached = names.get(start)
    if (cached !== undefined) return await cached
    const pending = resolveProjectName(start, markers)
    names.set(start, pending)
    return await pending
  }

  return {
    enabled: () => flags().enabled,
    claudeCompatible: () => flags().claudeCompatible,
    configuredDirectory: () => flags().directory,
    directoryFor: async (cwd) => {
      const project = await projectNameFor(cwd)
      if (flags().claudeCompatible) return join(claudeHome, 'projects', project, 'memory')
      return resolveMemoryDirectory(flags().directory, project)
    },
    indexLines: () => config.indexLines ?? DEFAULT_INDEX_LINES,
    indexBytes: () => config.indexBytes ?? DEFAULT_INDEX_BYTES,
    maxFileBytes: () => config.maxFileBytes ?? DEFAULT_MEMORY_LIMITS.maxFileBytes,
  }
}

/**
 * Resolve the Claude Code config directory.
 *
 * Claude Code itself reads `$CLAUDE_CONFIG_DIR`; `$CLAUDE_HOME` is the older
 * variable the sibling compatibility plugin already honored, and `~/.claude` is
 * the default.
 * @param config - composition configuration carrying an optional explicit home.
 * @returns the absolute Claude home path.
 */
export function resolveClaudeHome(config: MemoryConfig): string {
  return resolve(
    config.claudeHome
    ?? process.env.CLAUDE_CONFIG_DIR
    ?? process.env.CLAUDE_HOME
    ?? join(homedir(), '.claude'),
  )
}

/** The Claude-style project directory name for one session working directory. */
async function resolveProjectName(cwd: string, markers: readonly string[]): Promise<string> {
  const root = await findProjectRoot(cwd, markers)
  return projectSlug(await repositoryRoot(root))
}

/** Walk upward to the nearest ancestor holding a project-root marker. */
async function findProjectRoot(cwd: string, markers: readonly string[]): Promise<string> {
  let current = cwd
  for (;;) {
    for (const marker of markers) {
      if (await exists(join(current, marker))) return current
    }
    const parent = dirname(current)
    if (parent === current) return cwd
    current = parent
  }
}

/**
 * The repository a project root belongs to.
 *
 * A `.git` file means a linked worktree: it points at
 * `<main>/.git/worktrees/<name>`, so the main repository is recovered from that
 * path and every worktree of one repository shares a memory directory, as it
 * does in Claude Code.
 */
async function repositoryRoot(projectRoot: string): Promise<string> {
  const marker = join(projectRoot, '.git')
  const info = await statOrUndefined(marker)
  if (info === undefined || info.isDirectory()) return projectRoot
  const text = await readFileOrUndefined(marker)
  const target = /^gitdir:\s*(.+)$/m.exec(text ?? '')?.[1]?.trim()
  if (target === undefined) return projectRoot
  const match = /^(.*)[\\/]worktrees[\\/][^\\/]+$/u.exec(target)
  if (match?.[1] === undefined) return projectRoot
  return dirname(match[1])
}

async function exists(path: string): Promise<boolean> {
  return await statOrUndefined(path) !== undefined
}

async function statOrUndefined(path: string) {
  try {
    return await stat(path)
  } catch {
    return undefined
  }
}

async function readFileOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, { encoding: 'utf8' })
  } catch {
    return undefined
  }
}
