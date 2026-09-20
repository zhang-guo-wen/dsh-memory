/**
 * Memory plugin (host) with a browser settings page (client).
 *
 * Host: registers the `memory` tool set of Claude's memory tool over a
 * user-chosen directory, folds the memory index into a session's first request,
 * and exposes the `memory` settings namespace plus the `memoryStore` Remote the
 * settings page reads.
 * Client: `src/client` bundles the settings page into a `window.__ModuleLoader__`
 * handoff artifact served at `/plugins/<id>/client.js`.
 *
 * The directory is a plain memory directory in Claude's layout — an index file
 * named `MEMORY.md` and one topic file per memory — so pointing it at a Claude
 * Code `memory/` directory reads and writes exactly the files Claude keeps.
 * `CLAUDE.md` instruction files are not this plugin's surface; the
 * `@zhang-guo-wen/dsh-claude-compat` plugin owns those.
 *
 * @module @zhang-guo-wen/dsh-memory
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { memoryInstructionListener } from './instructions.ts'
import { MemoryRemote } from './remote.ts'
import { registerMemorySettings, type MemoryConfig } from './settings.ts'
import { DEFAULT_INDEX_BYTES, DEFAULT_INDEX_LINES, DEFAULT_MEMORY_LIMITS } from './store.ts'
import { DEFAULT_MEMORY_DIRECTORY } from './paths.ts'
import { registerMemoryTool } from './tool.ts'

export { MEMORY_PATH_PREFIX, MemoryPathError, projectSlug, resolveMemoryDirectory, resolveMemoryPath } from './paths.ts'
export {
  DEFAULT_INDEX_BYTES,
  DEFAULT_INDEX_LINES,
  MEMORY_INDEX_NAME,
  MemoryStore,
  type MemoryFileRow,
  type MemoryIndex,
  type MemoryLimits,
} from './store.ts'
export {
  MEMORY_SETTINGS_NAMESPACE,
  MEMORY_SETTINGS_SCHEMA,
  registerMemorySettings,
  resolveClaudeHome,
  type MemoryConfig,
  type MemoryRuntime,
  type MemorySettingsFlags,
} from './settings.ts'
export {
  MEMORY_LOADER,
  PLUGIN_ID,
  foldMemoryInstructions,
  isMemorySource,
  memoryInstructionListener,
  memorySource,
  renderMemoryInstructions,
} from './instructions.ts'
export { MEMORY_COMMANDS, MEMORY_TOOL_NAME, registerMemoryTool, runCommand, type MemoryCommand } from './tool.ts'
export { REMOTE_NAMESPACE, TYPERT_REMOTE } from './typert.ts'
export type * from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'memory'

/** Services this plugin requires; `settings` is probed lazily. */
export const inject = ['tools']

/** Composition configuration for the memory store. */
export type Config = MemoryConfig

/** Schemastery validation for {@link Config}. */
export const Config: Schema<Config> = z.object({
  enabled: z.boolean().default(true),
  directory: z.string().default(DEFAULT_MEMORY_DIRECTORY),
  claudeCompatible: z.boolean().default(false),
  claudeHome: z.string(),
  indexLines: z.number().step(1).min(1).default(DEFAULT_INDEX_LINES),
  indexBytes: z.number().step(1).min(1).default(DEFAULT_INDEX_BYTES),
  maxFileBytes: z.number().step(1).min(1).default(DEFAULT_MEMORY_LIMITS.maxFileBytes),
  projectRootMarkers: z.array(z.string()).default(['.git']),
})

/**
 * Register the memory settings namespace, the `memory` tool, the contributor
 * that folds the index into a session's first request, and the settings page's
 * Remote namespace.
 *
 * The tool follows the settings switch: turning memory off withdraws the tool
 * as well as stopping the injection, so a disabled deployment neither spends
 * request tokens on the schema nor lets the model write memories.
 * @param ctx - plugin context; every registration is disposed with it.
 * @param config - composition defaults and caps.
 */
export function apply(ctx: Context, config: Config = {}): void {
  let withdrawTool: (() => void) | undefined
  const syncTool = (): void => {
    const wanted = runtime.enabled()
    if (wanted && withdrawTool === undefined) withdrawTool = registerMemoryTool(ctx, runtime)
    if (!wanted && withdrawTool !== undefined) {
      withdrawTool()
      withdrawTool = undefined
    }
  }
  const runtime = registerMemorySettings(ctx, config, syncTool)
  syncTool()
  memoryInstructionListener(ctx, runtime)
  // The Remote owner registers itself as `ctx.memoryStore` on construction; the
  // service registry keeps the instance alive for this fiber's lifetime.
  void new MemoryRemote(ctx, runtime)
  ctx.effect(() => () => {
    withdrawTool?.()
    withdrawTool = undefined
  }, 'memory: tool lifetime')
}
