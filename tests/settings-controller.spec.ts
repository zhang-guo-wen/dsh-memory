import { describe, expect, it, vi } from 'vitest'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { DirectoryListing } from '@deepseek-ai/dsh-host-directory-picker/types'
import {
  MemorySectionController,
  type MemoryFlags,
  type MemoryHostCalls,
} from '../src/client/settings-controller.ts'
import type { MemoryStatusResult } from '../src/types.ts'

/** A Host report for one project, with every field the section reads. */
function statusResult(overrides: Partial<MemoryStatusResult> = {}): MemoryStatusResult {
  return {
    enabled: true,
    claudeCompatible: false,
    target: 'current',
    configured: '~/.dsh/memory/{project}',
    directory: '/home/u/.dsh/memory/-repo',
    projectScoped: true,
    exists: true,
    index: null,
    files: [],
    totalBytes: 0,
    maxFileBytes: 1_048_576,
    ...overrides,
  }
}

/** Host calls that answer one fixed report and record the index writes. */
function hostStub(): MemoryHostCalls & { written: string[] } {
  const written: string[] = []
  return {
    written,
    targets: async () => [],
    status: async target => statusResult({ target }),
    readIndex: async () => ({ exists: false, content: '' }),
    writeIndex: async (_target, content) => { written.push(content) },
    pick: async () => ({ ok: true, value: null }),
    list: async (): Promise<DirectoryListing> => ({
      path: '/home/u',
      home: '/home/u',
      crumbs: [],
      entries: [],
      truncated: false,
    }),
  }
}

/** A stand-in for the settings domain's `ConfigForm` over one `memory` section. */
interface FormStub {
  form: ConfigForm<MemoryFlags>
  /** Every queued field write, in order. */
  writes: Array<{ field: string; value: unknown }>
  /** Let the Host refuse every later write without moving the held value. */
  refuse(): void
}

function formStub(
  initial: Partial<MemoryFlags> = {},
  options: { writable?: boolean; status?: ConfigFormSnapshot<MemoryFlags>['status'] } = {},
): FormStub {
  const writable = options.writable ?? true
  const status = options.status ?? 'ready'
  let value: MemoryFlags = { enabled: true, directory: '', claudeCompatible: false, ...initial }
  const writes: Array<{ field: string; value: unknown }> = []
  let accepted = true
  const form: ConfigForm<MemoryFlags> = {
    getSnapshot: () => ({ status, value, base: undefined, user: undefined, revision: 1, writable, mode: 'host' }),
    subscribe: () => () => {},
    set: async (field, next) => {
      writes.push({ field, value: next })
      if (!accepted) return false
      value = { ...value, [field]: next }
      return true
    },
    unset: async () => true,
    mutate: async () => true,
  }
  return { form, writes, refuse: () => { accepted = false } }
}

describe('MemorySectionController', () => {
  it('projects the fields the configuration form holds', () => {
    const { form } = formStub({ enabled: false, claudeCompatible: true, directory: '~/memory/{project}' })
    const controller = new MemorySectionController(form, hostStub())

    const snapshot = controller.inject().hooks.memory.getSnapshot()
    expect(snapshot.available).toBe(true)
    expect(snapshot.writable).toBe(true)
    expect(snapshot.enabled).toBe(false)
    expect(snapshot.claudeCompatible).toBe(true)
    expect(snapshot.directory).toBe('~/memory/{project}')
    expect(snapshot.savedDirectory).toBe('~/memory/{project}')
  })

  it('reports an unexposed namespace as unavailable and refuses its writes', async () => {
    const { form, writes } = formStub({}, { status: 'unavailable', writable: false })
    const controller = new MemorySectionController(form, hostStub())

    expect(controller.inject().hooks.memory.getSnapshot().available).toBe(false)
    controller.inject().setEnabled(false)
    controller.inject().saveDirectory()
    await Promise.resolve()
    expect(writes).toEqual([])
  })

  it('commits one field per action through the form', async () => {
    const { form, writes } = formStub()
    const controller = new MemorySectionController(form, hostStub())
    const face = controller.inject()

    face.setEnabled(false)
    face.setClaudeCompatible(true)
    face.editDirectory('  ~/memory/{project}  ')
    face.saveDirectory()

    await vi.waitFor(() => { expect(writes).toHaveLength(3) })
    expect(writes).toEqual([
      { field: 'enabled', value: false },
      { field: 'claudeCompatible', value: true },
      { field: 'directory', value: '~/memory/{project}' },
    ])
    expect(face.hooks.memory.getSnapshot().savedDirectory).toBe('~/memory/{project}')
  })

  it('snaps back to what the form holds when the Host refuses the write', async () => {
    const stub = formStub({ enabled: true })
    stub.refuse()
    const controller = new MemorySectionController(stub.form, hostStub())
    const face = controller.inject()

    face.setEnabled(false)

    await vi.waitFor(() => { expect(face.hooks.memory.getSnapshot().enabled).toBe(true) })
    expect(stub.writes).toEqual([{ field: 'enabled', value: false }])
  })

  it('publishes the Host report and the index it read', async () => {
    const controller = new MemorySectionController(formStub().form, hostStub())
    const face = controller.inject()
    controller.start()

    await vi.waitFor(() => {
      expect(face.hooks.memory.getSnapshot().status.kind).toBe('ready')
    })
    const snapshot = face.hooks.memory.getSnapshot()
    expect(snapshot.status.kind === 'ready' && snapshot.status.value.directory).toBe('/home/u/.dsh/memory/-repo')
    expect(snapshot.index).toEqual({ kind: 'ready', exists: false, content: '', saved: '' })
  })
})
