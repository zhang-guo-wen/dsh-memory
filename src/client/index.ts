/**
 * Memory settings section, browser half. Mounts the `memoryStore` Remote,
 * registers the `settings.memory` dictionaries, and registers the one
 * `settings.section` entry that presents the memory directory.
 *
 * The section reads and writes the `memory` namespace the Host
 * `@guowenzhang/dsh-memory` plugin owns, so the page and the behavior share
 * one setting.
 * @module @guowenzhang/dsh-memory/client
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the configuration-form service merge (ctx.configForms) and slot types.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the slot registry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the Remote namespaces this plugin reads (ctx.remote.directoryPicker).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { DirectoryListing } from '@deepseek-ai/dsh-host-directory-picker/types'
import { TYPERT_REMOTE, REMOTE_NAMESPACE } from '../typert.ts'
import type {
  MemoryReadIndexRequest,
  MemoryReadIndexResult,
  MemoryStatusRequest,
  MemoryStatusResult,
  MemoryTargetsRequest,
  MemoryTargetsResult,
  MemoryWriteIndexRequest,
} from '../types.ts'
import { MemorySection } from './MemorySection.tsx'
import { en, NS, zh, type MemorySectionKey } from './locales.ts'
import {
  MEMORY_SETTINGS_NS,
  MemorySectionController,
  type MemoryFlags,
  type MemoryHostCalls,
  type PickResult,
} from './settings-controller.ts'

export type { MemorySectionProps } from './MemorySection.tsx'
export type { MemorySectionFace, MemorySectionState } from './settings-controller.ts'
export { NS } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This plugin's memory settings copy. */
    'settings.memory': MemorySectionKey
  }
}

/** Required services (cordis fiber inject). The directory picker is optional. */
export const inject = ['slots', 'locale', 'configForms', 'remote']

/** The namespace service this plugin mounts itself — fetched via `ctx.get`, never injected. */
interface MemoryStoreNamespace {
  targets(request: MemoryTargetsRequest): Promise<RemoteResult<MemoryTargetsResult>>
  status(request: MemoryStatusRequest): Promise<RemoteResult<MemoryStatusResult>>
  readIndex(request: MemoryReadIndexRequest): Promise<RemoteResult<MemoryReadIndexResult>>
  writeIndex(request: MemoryWriteIndexRequest): Promise<RemoteResult<{ bytes: number; lines: number }>>
}

/** Unwrap a Typert `RemoteResult` or surface the Host failure. */
async function unwrapRemote<T>(call: () => Promise<RemoteResult<T>>): Promise<T> {
  const result = await call()
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

/**
 * Register the dictionaries, the Remote mount, and the memory settings section.
 * @param ctx - client root context.
 */
export async function apply(ctx: Context): Promise<void> {
  const disposeMount = await ctx.remote.$mount(TYPERT_REMOTE)
  ctx.effect(() => () => disposeMount(), 'dsh-memory: remote mount')

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-memory: dictionaries')
  const t = ctx.locale.bind(NS)

  const namespace = (): MemoryStoreNamespace => {
    const mounted = ctx.get(`remote.${REMOTE_NAMESPACE}`) as MemoryStoreNamespace | undefined
    if (mounted === undefined) throw new Error(`${REMOTE_NAMESPACE} namespace service is not mounted`)
    return mounted
  }
  // The composed picker serves either an OS chooser or the in-app browse
  // primitives; a composition without one leaves the directory field manual.
  const picker = (): {
    pick(): Promise<RemoteResult<string | null>>
    list(path?: string): Promise<RemoteResult<DirectoryListing>>
  } | undefined => ctx.get('remote.directoryPicker')

  const host: MemoryHostCalls = {
    targets: async () => (await unwrapRemote(() => namespace().targets({}))).targets,
    status: async target => await unwrapRemote(() => namespace().status({ target })),
    readIndex: async (target) => {
      const result = await unwrapRemote(() => namespace().readIndex({ target }))
      return { exists: result.exists, content: result.content }
    },
    writeIndex: async (target, content) => {
      await unwrapRemote(() => namespace().writeIndex({ target, content }))
    },
    pick: async (): Promise<PickResult> => {
      const composed = picker()
      if (composed === undefined) {
        return { ok: false, unavailable: false, message: 'no directory picker is composed in this host' }
      }
      const result = await composed.pick()
      if (result.ok) return { ok: true, value: result.value }
      return {
        ok: false,
        unavailable: result.error.code === 'directory-picker/unavailable',
        message: `${result.error.code}: ${result.error.message}`,
      }
    },
    list: async (path) => {
      const composed = picker()
      if (composed === undefined) throw new Error('no directory picker is composed in this host')
      return await unwrapRemote(() => composed.list(path))
    },
  }

  const controller = new MemorySectionController(
    ctx.configForms.get<MemoryFlags>(MEMORY_SETTINGS_NS),
    host,
  )
  ctx.effect(() => () => { controller.dispose() }, 'ui-memory: settings form')
  controller.start()

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'memory',
    order: 15,
    label: () => t('nav'),
    locale: NS,
    inject: () => controller.inject(),
  }, MemorySection))
}
