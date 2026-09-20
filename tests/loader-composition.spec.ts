import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as Memory from '../src/index.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/**
 * Boot the real Loader over a two-row composition: the registries this plugin
 * injects, plus the plugin itself.
 * @param lines - cordis.yml rows.
 * @returns the booted context.
 */
async function loadYaml(lines: readonly string[]): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-memory-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [...lines, ''].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@zhang-guo-wen/dsh-memory', Memory],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

describe('real Loader composition', () => {
  it('activates the plugin and registers its tool, Remote, and settings namespace', async () => {
    const memoryRoot = await mkdtemp(join(tmpdir(), 'dsh-memory-dir-'))
    const loaded = await loadYaml([
      "- name: '@deepseek-ai/dsh-system-prompt'",
      "- name: '@deepseek-ai/dsh-tools'",
      "- name: '@zhang-guo-wen/dsh-memory'",
      '  config:',
      '    directory: ' + JSON.stringify(memoryRoot),
    ])

    const inactive = [...loaded.loader.entries()]
      .filter(entry => entry.fiber === undefined && !entry.disabled)
      .map(entry => entry.options.name)
    expect(inactive).toEqual([])

    const registered = loaded.tools.get('memory')
    expect(registered?.description).toContain('/memories')
    expect(loaded.tools.schemas().map(schema => schema.name)).toContain('memory')
    expect(loaded.get('memoryStore')).toBeDefined()

    const targets = (await loaded.memoryStore.targets({})).targets
    expect(targets[0]?.id).toBe('current')
    expect(targets[0]?.directory).toBe(memoryRoot)

    const status = await loaded.memoryStore.status({})
    expect(status.target).toBe('current')
    expect(status.directory).toBe(memoryRoot)
    expect(status.enabled).toBe(true)
    expect(status.index).toBeNull()

    // An unknown selection falls back to the host process's own project.
    expect((await loaded.memoryStore.status({ target: 'workspace:gone' })).target).toBe('current')

    const written = await loaded.memoryStore.writeIndex({ content: '- [Notes](notes.md) — hooks\n' })
    expect(written.lines).toBe(1)
    expect((await loaded.memoryStore.readIndex({})).content).toContain('[Notes](notes.md)')
    expect((await loaded.memoryStore.status({})).index?.truncated).toBe(false)

    await rm(memoryRoot, { recursive: true, force: true })
  })

  it('keeps its rows out of a composition that disables the plugin', async () => {
    const loaded = await loadYaml([
      "- name: '@deepseek-ai/dsh-system-prompt'",
      "- name: '@deepseek-ai/dsh-tools'",
      "- name: '@zhang-guo-wen/dsh-memory'",
      '  disabled: true',
    ])
    expect(loaded.tools.get('memory')).toBeUndefined()
    expect(loaded.get('memoryStore')).toBeUndefined()
  })

  it('withdraws the tool when memory is off, and keeps the settings page working', async () => {
    const memoryRoot = await mkdtemp(join(tmpdir(), 'dsh-memory-off-'))
    const loaded = await loadYaml([
      "- name: '@deepseek-ai/dsh-system-prompt'",
      "- name: '@deepseek-ai/dsh-tools'",
      "- name: '@zhang-guo-wen/dsh-memory'",
      '  config:',
      '    enabled: false',
      '    directory: ' + JSON.stringify(memoryRoot),
    ])
    expect(loaded.tools.get('memory')).toBeUndefined()
    expect((await loaded.memoryStore.status({})).enabled).toBe(false)
    await rm(memoryRoot, { recursive: true, force: true })
  })
})
