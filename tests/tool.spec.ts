import { describe, expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { MemoryRuntime } from '../src/settings.ts'
import { registerMemorySettings } from '../src/settings.ts'
import { MEMORY_TOOL_NAME, registerMemoryTool, runCommand } from '../src/tool.ts'
import { MemoryStore } from '../src/store.ts'

/** A context that records registrations instead of reaching a real registry. */
function recordingCtx(): { ctx: Context; tools: ToolDefinition[] } {
  const tools: ToolDefinition[] = []
  const ctx = {
    effect: (execute: () => unknown) => execute(),
    tools: { register: (definition: ToolDefinition) => { tools.push(definition); return () => {} } },
  } as unknown as Context
  return { ctx, tools }
}

/** The runtime a composition without a settings provider produces. */
function runtimeFor(directory: string): MemoryRuntime {
  const ctx = { get: () => undefined, inject: () => undefined } as unknown as Context
  return registerMemorySettings(ctx, { directory })
}

async function tempRoot(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'dsh-memory-tool-'))
}

describe('registerMemoryTool', () => {
  it('registers a memory tool whose parameters carry the command set', () => {
    const { ctx, tools } = recordingCtx()
    registerMemoryTool(ctx, runtimeFor('/memories'))
    expect(tools).toHaveLength(1)
    const tool = tools[0]!
    expect(tool.name).toBe(MEMORY_TOOL_NAME)
    const properties = tool.parameters.properties as Record<string, { enum?: string[] }>
    expect(properties.command?.enum).toEqual(['view', 'create', 'str_replace', 'insert', 'delete', 'rename'])
    expect(tool.parameters.required).toEqual(['command'])
  })

  it('runs a command against the session project directory and renders its reply', async () => {
    const { ctx, tools } = recordingCtx()
    const root = await tempRoot()
    registerMemoryTool(ctx, runtimeFor(root))
    const tool = tools[0]!
    const exec = {
      agent: { session: { header: { cwd: root } } },
      signal: new AbortController().signal,
    } as unknown as ToolRunContext

    const created = await tool.execute({ command: 'create', path: '/memories/one.md', file_text: 'one' }, exec)
    expect(created).toEqual({
      command: 'create',
      path: '/memories/one.md',
      message: 'File created successfully at: /memories/one.md',
    })
    expect(tool.output.render({}, created as never)).toEqual([
      { type: 'text', text: 'File created successfully at: /memories/one.md' },
    ])

    const viewed = await tool.execute({ command: 'view', path: '/memories/one.md' }, exec)
    expect(viewed).toMatchObject({ path: '/memories/one.md' })
    expect((viewed as { message: string }).message).toContain('     1\tone')
  })

  it('answers a non-agent caller from the process project', async () => {
    const { ctx, tools } = recordingCtx()
    const root = await tempRoot()
    registerMemoryTool(ctx, runtimeFor(root))
    const exec = { signal: new AbortController().signal } as unknown as ToolRunContext
    const result = await tools[0]!.execute({ command: 'view', path: '/memories' }, exec)
    expect((result as { message: string }).message).toContain('excluding hidden items')
  })
})

describe('runCommand', () => {
  it('answers every command with the store reply', async () => {
    const store = new MemoryStore(await tempRoot())
    expect(await runCommand(store, { command: 'create', path: '/memories/a.md', file_text: 'a\nb' }))
      .toBe('File created successfully at: /memories/a.md')
    expect(await runCommand(store, { command: 'str_replace', path: '/memories/a.md', old_str: 'a', new_str: 'A' }))
      .toContain('The memory file has been edited.')
    expect(await runCommand(store, { command: 'insert', path: '/memories/a.md', insert_line: 0, insert_text: 'top' }))
      .toBe('The file /memories/a.md has been edited.')
    expect(await runCommand(store, { command: 'rename', old_path: '/memories/a.md', new_path: '/memories/b.md' }))
      .toBe('Successfully renamed /memories/a.md to /memories/b.md')
    expect(await runCommand(store, { command: 'delete', path: '/memories/b.md' }))
      .toBe('Successfully deleted /memories/b.md')
  })

  it('names the field a command is missing', async () => {
    const store = new MemoryStore(await tempRoot())
    expect(await runCommand(store, { command: 'create' })).toBe(
      'Error: `path` is required for the create command.',
    )
    expect(await runCommand(store, { command: 'insert', path: '/memories/a.md' })).toBe(
      'Error: `insert_line` is required for the insert command.',
    )
    expect(await runCommand(store, { command: 'rename', old_path: '/memories/a.md' })).toBe(
      'Error: `new_path` is required for the rename command.',
    )
  })

  it('answers an unknown command with the accepted set', async () => {
    const store = new MemoryStore(await tempRoot())
    expect(await runCommand(store, { command: 'append' })).toContain('unknown memory command')
  })

  it('answers a refused path with the memory tool wording', async () => {
    const store = new MemoryStore(await tempRoot())
    expect(await runCommand(store, { command: 'view', path: '/etc/passwd' })).toBe(
      'Path must start with /memories, got: /etc/passwd',
    )
  })
})
