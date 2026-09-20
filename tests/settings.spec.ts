import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import {
  DEFAULT_MEMORY_DIRECTORY,
  projectSlug,
  resolveMemoryDirectory,
} from '../src/paths.ts'
import {
  MEMORY_SETTINGS_NAMESPACE,
  MEMORY_SETTINGS_SCHEMA,
  registerMemorySettings,
} from '../src/settings.ts'

/** A context with no settings provider and no services. */
function bareCtx(): Context {
  return { get: () => undefined, inject: () => undefined } as unknown as Context
}

/** A context whose settings service registers the namespace over a mutable store. */
function settingsCtx(store: { value: { enabled: boolean; directory: string } }): Context {
  return {
    get: () => undefined,
    inject: (_deps: string[], callback: (ctx: unknown) => void) => {
      callback({
        settings: {
          register: (namespace: string, schema: unknown, options: { base?: unknown }) => {
            expect(namespace).toBe(MEMORY_SETTINGS_NAMESPACE)
            expect(schema).toBe(MEMORY_SETTINGS_SCHEMA)
            store.value = { ...(options.base as typeof store.value), ...store.value }
            return { get: () => store.value, watch: () => () => true }
          },
        },
      })
      return undefined
    },
  } as unknown as Context
}

async function tempDir(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix))
}

describe('resolveMemoryDirectory', () => {
  it('expands ~ and defaults a blank configuration', () => {
    expect(resolveMemoryDirectory('~/memory', 'proj')).toBe(join(homedir(), 'memory'))
    expect(resolveMemoryDirectory('', 'proj')).toBe(join(homedir(), '.dsh', 'memory'))
    expect(DEFAULT_MEMORY_DIRECTORY).toBe('~/.dsh/memory')
  })

  it('substitutes the project token and leaves a plain directory alone', () => {
    const base = join(tmpdir(), 'mem')
    expect(resolveMemoryDirectory(join(base, '{project}', 'memory'), 'C--src-app'))
      .toBe(join(base, 'C--src-app', 'memory'))
    expect(resolveMemoryDirectory(join(base, 'shared'), 'proj')).toBe(join(base, 'shared'))
  })

  it('names a project the way Claude names its projects directory', () => {
    expect(projectSlug('C:\\02-codespace\\deepseek-harness')).toBe('C--02-codespace-deepseek-harness')
    expect(projectSlug('/home/u/app')).toBe('-home-u-app')
  })
})

describe('registerMemorySettings', () => {
  it('reports the composition defaults without a settings provider', async () => {
    const root = await tempDir('dsh-memory-settings-')
    const runtime = registerMemorySettings(bareCtx(), { directory: root, enabled: false })
    expect(runtime.configuredDirectory()).toBe(root)
    expect(runtime.enabled()).toBe(false)
    expect(await runtime.directoryFor(undefined)).toBe(root)
  })

  it('defaults every field when the composition names none', () => {
    const runtime = registerMemorySettings(bareCtx(), {})
    expect(runtime.configuredDirectory()).toBe(DEFAULT_MEMORY_DIRECTORY)
    expect(runtime.enabled()).toBe(true)
    expect(runtime.indexLines()).toBe(200)
    expect(runtime.indexBytes()).toBe(25_600)
    expect(runtime.maxFileBytes()).toBe(1_048_576)
  })

  it('follows the registered namespace when a settings service is mounted', () => {
    const store = { value: { enabled: true, directory: '/from/user' } }
    const runtime = registerMemorySettings(settingsCtx(store), { directory: '/from/config' })
    expect(runtime.configuredDirectory()).toBe('/from/user')
  })

  it('substitutes the session project when the directory carries the token', async () => {
    const root = join(await tempDir('dsh-memory-settings-'), 'repo')
    await mkdir(join(root, '.git'), { recursive: true })
    await mkdir(join(root, 'packages', 'app'), { recursive: true })
    const runtime = registerMemorySettings(bareCtx(), { directory: join(root, '{project}', 'memory') })
    expect(await runtime.directoryFor(join(root, 'packages', 'app'))).toBe(join(root, projectSlug(root), 'memory'))
  })

  it('resolves a linked worktree back to its repository', async () => {
    const home = await tempDir('dsh-memory-worktree-')
    const repo = join(home, 'repo')
    const worktree = join(home, 'wt')
    await mkdir(join(repo, '.git', 'worktrees', 'wt'), { recursive: true })
    await mkdir(worktree, { recursive: true })
    await writeFile(join(worktree, '.git'), `gitdir: ${join(repo, '.git', 'worktrees', 'wt')}\n`)
    const runtime = registerMemorySettings(bareCtx(), { directory: join(home, '{project}', 'memory') })
    expect(await runtime.directoryFor(worktree)).toBe(join(home, projectSlug(repo), 'memory'))
  })
})
