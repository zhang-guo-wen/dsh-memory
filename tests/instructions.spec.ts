import { describe, expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import {
  foldMemoryInstructions,
  isMemorySource,
  memoryInstructionListener,
  memorySource,
  renderMemoryInstructions,
} from '../src/instructions.ts'
import type { MemoryRuntime } from '../src/settings.ts'
import { registerMemorySettings } from '../src/settings.ts'
import { MemoryStore } from '../src/store.ts'

/** A context that only records the pre-step listener. */
function listenerCtx(): {
  ctx: Context
  step: (payload: unknown, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>
} {
  let handler: ((payload: never, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>) | undefined
  const ctx = {
    on: (name: string, listener: typeof handler) => {
      if (name === 'agent/pre-step') handler = listener
      return () => true
    },
  } as unknown as Context
  return {
    ctx,
    step: async (payload, next) => {
      if (handler === undefined) throw new Error('no pre-step listener was registered')
      return await handler(payload as never, next)
    },
  }
}

function runtimeFor(directory: string): MemoryRuntime {
  const ctx = { get: () => undefined, inject: () => undefined } as unknown as Context
  return registerMemorySettings(ctx, { directory })
}

function fakeSession(cwd: string, events: unknown[] = []): Session {
  return {
    header: { cwd },
    snapshotEvents: () => events,
  } as unknown as Session
}

async function tempRoot(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'dsh-memory-instructions-'))
}

describe('renderMemoryInstructions', () => {
  it('states the directory, the two-step protocol, and the index', () => {
    const text = renderMemoryInstructions('/home/u/.dsh/memory', {
      content: '- [Notes](notes.md) — hooks\n',
      bytes: 30,
      lines: 1,
      truncated: false,
    })
    expect(text).toContain('persistent memory directory at /home/u/.dsh/memory')
    expect(text).toContain('addresses it as `/memories`')
    expect(text).toContain('**Step 2**')
    expect(text).toContain('## Memory index')
    expect(text).toContain('- [Notes](notes.md) — hooks')
  })

  it('says so when the directory has no index yet', () => {
    expect(renderMemoryInstructions('/root', undefined)).toContain('MEMORY.md does not exist yet')
  })

  it('says so when the index is empty, and flags a truncated one', () => {
    expect(renderMemoryInstructions('/root', { content: '  \n', bytes: 3, lines: 1, truncated: false }))
      .toContain('exists but is empty')
    expect(renderMemoryInstructions('/root', { content: 'x', bytes: 1, lines: 1, truncated: true }))
      .toContain('truncated to the lines and bytes a session loads')
  })
})

describe('memorySource', () => {
  it('records the plugin and its loader under the released plugin kind', () => {
    expect(memorySource()).toEqual({
      kind: 'plugin',
      plugin: '@zhang-guo-wen/dsh-memory#memory-index',
      form: 'instructions',
    })
    expect(isMemorySource(memorySource())).toBe(true)
    expect(isMemorySource({ kind: 'plugin', plugin: 'other' })).toBe(false)
    expect(isMemorySource(undefined)).toBe(false)
  })
})

describe('foldMemoryInstructions', () => {
  it('inserts the instructions after the last user message, or appends them', () => {
    const first = createUserMessage({ content: [{ type: 'text', text: 'question' }], source: { kind: 'user' } })
    const folded = foldMemoryInstructions([first], 'memory text')
    expect(folded).toHaveLength(2)
    expect(folded[1]?.content).toEqual([{ type: 'text', text: 'memory text' }])
    expect(isMemorySource(folded[1]?.source)).toBe(true)

    const appended = foldMemoryInstructions([], 'memory text')
    expect(appended).toHaveLength(1)
  })
})

describe('memoryInstructionListener', () => {
  it('folds the instructions into the first step that carries a message', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.writeIndex('- [Notes](notes.md) — hooks\n')
    const { ctx, step } = listenerCtx()
    memoryInstructionListener(ctx, runtimeFor(root))

    const session = fakeSession(root)
    const entering = createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } })
    const decision = await step(
      { agent: { session }, messages: [], turn: 1, step: 1, signal: new AbortController().signal },
      () => Promise.resolve({ kind: 'enter', messages: [entering] }),
    )
    expect(decision.kind).toBe('enter')
    const messages = decision.kind === 'enter' ? decision.messages : []
    expect(messages).toHaveLength(2)
    expect(isMemorySource(messages[1]?.source)).toBe(true)
    expect(JSON.stringify(messages[1]?.content)).toContain('- [Notes](notes.md) — hooks')
  })

  it('folds once per session', async () => {
    const root = await tempRoot()
    const { ctx, step } = listenerCtx()
    memoryInstructionListener(ctx, runtimeFor(root))
    const session = fakeSession(root)
    const entering = createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } })
    const payload = { agent: { session }, messages: [], turn: 1, step: 1, signal: new AbortController().signal }

    const first = await step(payload, () => Promise.resolve({ kind: 'enter', messages: [entering] }))
    const second = await step(payload, () => Promise.resolve({ kind: 'enter', messages: [entering] }))
    expect(first.kind === 'enter' ? first.messages : []).toHaveLength(2)
    expect(second.kind === 'enter' ? second.messages : []).toHaveLength(1)
  })

  it('leaves a resumed session that already carries the instructions alone', async () => {
    const root = await tempRoot()
    const { ctx, step } = listenerCtx()
    memoryInstructionListener(ctx, runtimeFor(root))
    const entering = createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } })
    const logged = createUserMessage({ content: [{ type: 'text', text: 'memory' }], source: memorySource() })
    const session = fakeSession(root, [{ type: 'user/message', data: logged }])

    const decision = await step(
      { agent: { session }, messages: [], turn: 2, step: 1, signal: new AbortController().signal },
      () => Promise.resolve({ kind: 'enter', messages: [entering] }),
    )
    expect(decision.kind === 'enter' ? decision.messages : []).toHaveLength(1)
  })

  it('waits for a step that carries a message, and stays out when disabled', async () => {
    const root = await tempRoot()
    const { ctx, step } = listenerCtx()
    const runtime = runtimeFor(root)
    memoryInstructionListener(ctx, { ...runtime, enabled: () => false })
    const entering = createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } })
    const payload = { agent: { session: fakeSession(root) }, messages: [], turn: 1, step: 1, signal: new AbortController().signal }
    const empty = await step({ ...payload, agent: { session: fakeSession(join(root, 'other')) } }, () => Promise.resolve({ kind: 'enter', messages: [] }))
    expect(empty.kind === 'enter' ? empty.messages : []).toHaveLength(0)
    const disabled = await step(payload, () => Promise.resolve({ kind: 'enter', messages: [entering] }))
    expect(disabled.kind === 'enter' ? disabled.messages : []).toHaveLength(1)
  })
})
