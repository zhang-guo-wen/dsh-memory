/**
 * The projects the settings page can look at.
 *
 * A memory directory is resolved per project, so one page cannot show them all
 * at once. This module answers with the stores a deployment knows about — the
 * host process's own project, every DSH workspace, and (in Claude-directory
 * mode) every project directory Claude Code keeps — and resolves a selection
 * back to the directory it names.
 *
 * Workspaces come from `ctx.workspaceRegistry` when it is mounted; a
 * composition without it still lists the current project and, in Claude mode,
 * Claude's own project directories.
 *
 * @module @guowenzhang/dsh-memory/targets
 */

import { readdir, stat } from 'node:fs/promises'
import { basename, join, normalize, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { MemoryRuntime } from './settings.ts'
import type { MemoryTargetView } from './types.ts'

/** Selection id of the host process's own project. */
export const CURRENT_TARGET_ID = 'current'

/** Prefix of a DSH workspace selection id. */
export const WORKSPACE_TARGET_PREFIX = 'workspace:'

/** Prefix of a Claude project selection id. */
export const CLAUDE_TARGET_PREFIX = 'claude:'

/** One workspace entry as this plugin reads it. */
interface WorkspaceLike {
  readonly id: string
  readonly path: string
  readonly title: string
}

/** The workspace registry, when the composition mounts one. */
function workspaces(ctx: Context): readonly WorkspaceLike[] {
  const registry = ctx.get('workspaceRegistry') as { list(): WorkspaceLike[] } | undefined
  try {
    return registry?.list() ?? []
  } catch {
    // A registry that is still opening has nothing to list; the page shows the
    // remaining targets rather than failing the whole request.
    return []
  }
}

/**
 * List the memory stores this deployment can show, nearest first.
 *
 * Rows are deduplicated by their resolved directory, so a workspace and the
 * Claude project it maps to appear once.
 * @param ctx - host context (uses `ctx.workspaceRegistry` when present).
 * @param runtime - live settings and directory resolution.
 * @returns the current project, every workspace, and Claude's project directories.
 */
export async function listMemoryTargets(ctx: Context, runtime: MemoryRuntime): Promise<MemoryTargetView[]> {
  const rows: MemoryTargetView[] = []
  const seen = new Set<string>()

  const push = async (id: string, label: string, detail: string, directory: string): Promise<void> => {
    const key = normalize(directory).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    rows.push({ id, label, detail, directory, exists: await existsAt(directory) })
  }

  const current = resolve(process.cwd())
  await push(CURRENT_TARGET_ID, basename(current) || current, current, await runtime.directoryFor(current))
  for (const workspace of workspaces(ctx)) {
    await push(
      `${WORKSPACE_TARGET_PREFIX}${workspace.id}`,
      workspace.title,
      workspace.path,
      await runtime.directoryFor(workspace.path),
    )
  }
  if (runtime.claudeCompatible()) {
    for (const slug of await claudeProjectSlugs(runtime)) {
      await push(
        `${CLAUDE_TARGET_PREFIX}${slug}`,
        slug,
        join(runtime.claudeProjectsRoot(), slug),
        runtime.claudeProjectDirectory(slug),
      )
    }
  }
  return rows
}

/**
 * Resolve one selection back to the memory directory it names.
 *
 * An unknown or absent id — a stale selection, or a composition without a
 * workspace registry — falls back to the host process's own project rather than
 * failing the request.
 * @param ctx - host context (uses `ctx.workspaceRegistry` when present).
 * @param runtime - live settings and directory resolution.
 * @param target - selection id from {@link listMemoryTargets}.
 * @returns the selection id that was used and its absolute memory directory.
 */
export async function resolveMemoryTarget(
  ctx: Context,
  runtime: MemoryRuntime,
  target: string | undefined,
): Promise<{ id: string; directory: string }> {
  if (target !== undefined && target.startsWith(WORKSPACE_TARGET_PREFIX)) {
    const id = target.slice(WORKSPACE_TARGET_PREFIX.length)
    const workspace = workspaces(ctx).find(candidate => candidate.id === id)
    if (workspace !== undefined) return { id: target, directory: await runtime.directoryFor(workspace.path) }
  }
  if (target !== undefined && target.startsWith(CLAUDE_TARGET_PREFIX)) {
    return { id: target, directory: runtime.claudeProjectDirectory(target.slice(CLAUDE_TARGET_PREFIX.length)) }
  }
  return { id: CURRENT_TARGET_ID, directory: await runtime.directoryFor(undefined) }
}

/** The project directories Claude Code keeps under its home. */
async function claudeProjectSlugs(runtime: MemoryRuntime): Promise<string[]> {
  try {
    const entries = await readdir(runtime.claudeProjectsRoot(), { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => entry.name)
      .sort()
  } catch {
    return []
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
