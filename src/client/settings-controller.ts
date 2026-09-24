/**
 * Controller bridging the Host `memory` settings namespace and the
 * `memoryStore` Remote onto the settings section snapshot.
 *
 * The section owns one draft per writable value (the directory field and the
 * index editor) and one host report; every action commits through the
 * configuration form or the Remote and then republishes, so what the page shows
 * is what the Host holds.
 *
 * @module @guowenzhang/dsh-memory/client/settings-controller
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { DirectoryListing } from '@deepseek-ai/dsh-host-directory-picker/types'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { MemoryIndexView, MemoryStatusResult, MemoryTargetView } from '../types.ts'

/** Settings namespace registered Host-side by @guowenzhang/dsh-memory. */
export const MEMORY_SETTINGS_NS = 'memory'

/** The fields the memory namespace owns. */
export interface MemoryFlags {
  enabled: boolean
  directory: string
  claudeCompatible: boolean
}

/** How the Host answered the last state request. */
export type MemoryStatusState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly value: MemoryStatusResult }
  | { readonly kind: 'error'; readonly message: string }

/** The index editor's state. */
export type MemoryIndexState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly exists: boolean; readonly content: string; readonly saved: string }
  | { readonly kind: 'error'; readonly message: string }

/** The in-app directory browser, used when the composed picker is not native. */
export type MemoryBrowserState =
  | { readonly kind: 'closed' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly listing: DirectoryListing }
  | { readonly kind: 'error'; readonly message: string }

/** Snapshot the section renders. */
export interface MemorySectionState {
  /** Whether the namespace is exposed to this client. */
  readonly available: boolean
  /** Whether the Host document accepts writes. */
  readonly writable: boolean
  readonly enabled: boolean
  /** Whether the store is Claude Code's own memory directory. */
  readonly claudeCompatible: boolean
  /** The directory field's draft value. */
  readonly directory: string
  /** The committed directory value, for the field's dirty state. */
  readonly savedDirectory: string
  readonly status: MemoryStatusState
  readonly index: MemoryIndexState
  readonly browser: MemoryBrowserState
  /** Projects the Host offers, nearest first. */
  readonly targets: readonly MemoryTargetView[]
  /** Selection id of the project the report describes. */
  readonly target: string
  /** A one-line result of the last action, shown under the toolbar. */
  readonly notice: string | null
}

/** One directory-picking result the Host can answer with. */
export type PickResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly unavailable: boolean; readonly message: string }

/** Host calls the section needs. */
export interface MemoryHostCalls {
  /** List the projects the Host can show. */
  targets(): Promise<readonly MemoryTargetView[]>
  /** Read one project's memory store state. */
  status(target: string): Promise<MemoryStatusResult>
  /** Read one project's index file. */
  readIndex(target: string): Promise<{ exists: boolean; content: string }>
  /** Replace one project's index file content. */
  writeIndex(target: string, content: string): Promise<void>
  /** Ask for the composed picker's native chooser. */
  pick(): Promise<PickResult>
  /** List one directory level through the composed picker's browse capability. */
  list(path: string | undefined): Promise<DirectoryListing>
}

/** Registration-side face for the section. */
export interface MemorySectionFace {
  hooks: {
    /** Section snapshot bound by the renderer as useMemory. */
    memory: SnapshotStore<MemorySectionState>
  }
  /** Turn memory on or off. */
  setEnabled(value: boolean): void
  /** Follow Claude Code's own memory directory instead of a chosen one. */
  setClaudeCompatible(value: boolean): void
  /** Edit the directory field without committing it. */
  editDirectory(value: string): void
  /** Commit the directory field. */
  saveDirectory(): void
  /** Re-read the Host report and the index. */
  refresh(): void
  /** Show another project's memory store. */
  selectTarget(id: string): void
  /** Edit the index draft without saving it. */
  editIndex(value: string): void
  /** Write the index draft to the memory directory. */
  saveIndex(): void
  /** Open the picker: the native chooser when composed, listing otherwise. */
  chooseDirectory(): void
  /** List one directory level in the in-app browser. */
  browse(path?: string): void
  /** Close the in-app browser. */
  closeBrowser(): void
  /** Commit the browser's current directory as the memory directory. */
  useBrowsed(): void
}

/** Owner handle over the namespace, the Remote, and the section snapshot. */
export class MemorySectionController {
  private readonly store: SnapshotStore<MemorySectionState>
  private readonly unsubscribe: () => void
  private status: MemoryStatusState = { kind: 'loading' }
  private index: MemoryIndexState = { kind: 'loading' }
  private browser: MemoryBrowserState = { kind: 'closed' }
  private directory = ''
  private savedDirectory = ''
  private enabled = true
  private claudeCompatible = false
  private targets: readonly MemoryTargetView[] = []
  private target = 'current'
  private notice: string | null = null

  /**
   * @param scope - the `memory` configuration form.
   * @param host - the Remote calls the section drives.
   */
  constructor(
    private readonly scope: ConfigForm<MemoryFlags>,
    private readonly host: MemoryHostCalls,
  ) {
    this.store = createSnapshotStore(this.projection())
    this.unsubscribe = scope.subscribe(() => {
      this.readFlags()
      this.publish()
      this.refresh()
    })
    this.readFlags()
    this.publish()
  }

  /** Start the section: read the flags, the Host report, and the index. */
  start(): void {
    this.refresh()
  }

  /** Stop observing settings. */
  dispose(): void {
    this.unsubscribe()
  }

  /** Build the renderer face for this section. */
  inject(): MemorySectionFace {
    return {
      hooks: { memory: this.store },
      setEnabled: value => { this.setEnabled(value) },
      setClaudeCompatible: value => { this.setClaudeCompatible(value) },
      editDirectory: value => { this.directory = value; this.publish() },
      saveDirectory: () => { this.saveDirectory() },
      refresh: () => { this.refresh() },
      selectTarget: id => { this.selectTarget(id) },
      editIndex: value => { this.editIndex(value) },
      saveIndex: () => { this.saveIndex() },
      chooseDirectory: () => { this.chooseDirectory() },
      browse: path => { this.browse(path) },
      closeBrowser: () => { this.browser = { kind: 'closed' }; this.publish() },
      useBrowsed: () => { this.useBrowsed() },
    }
  }

  private readFlags(): void {
    const snapshot = this.scope.getSnapshot()
    const value = snapshot.value
    this.enabled = value?.enabled ?? true
    this.claudeCompatible = value?.claudeCompatible ?? false
    const directory = value?.directory ?? ''
    this.directory = directory
    this.savedDirectory = directory
  }

  private projection(): MemorySectionState {
    const snapshot = this.scope.getSnapshot()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      enabled: this.enabled,
      claudeCompatible: this.claudeCompatible,
      directory: this.directory,
      savedDirectory: this.savedDirectory,
      status: this.status,
      index: this.index,
      browser: this.browser,
      targets: this.targets,
      target: this.target,
      notice: this.notice,
    }
  }

  private publish(): void {
    this.store.set(this.projection())
  }

  private setEnabled(value: boolean): void {
    if (!this.canWrite()) return
    this.enabled = value
    this.publish()
    void this.commit('enabled', value)
  }

  private setClaudeCompatible(value: boolean): void {
    if (!this.canWrite()) return
    this.claudeCompatible = value
    this.browser = { kind: 'closed' }
    this.publish()
    void this.commit('claudeCompatible', value)
  }

  /**
   * Show another project's store.
   *
   * A project the Host no longer offers — a workspace removed between two
   * refreshes — falls back to the Host's own answer (`status.target`), which is
   * where an unknown id lands anyway.
   */
  private selectTarget(id: string): void {
    this.target = id
    this.index = { kind: 'loading' }
    this.publish()
    void this.refresh()
  }

  /**
   * Commit one settings field and re-read the Host's answer.
   *
   * A Host that does not know the field — an older plugin build still loaded in
   * the process — leaves the document unchanged, so the switch must snap back to
   * what the Host actually holds instead of showing a write that never took.
   */
  private async commit(field: keyof MemoryFlags, value: unknown): Promise<void> {
    await this.run(async () => { await this.scope.set(field, value) })
    this.readFlags()
    this.publish()
  }

  private saveDirectory(): void {
    if (!this.canWrite()) return
    const directory = this.directory.trim()
    this.savedDirectory = directory
    this.notice = null
    this.publish()
    void this.commit('directory', directory)
  }

  private editIndex(content: string): void {
    if (this.index.kind !== 'ready') return
    this.index = { ...this.index, content }
    this.publish()
  }

  private saveIndex(): void {
    if (this.index.kind !== 'ready' || !this.canWrite()) return
    const content = this.index.content
    void this.run(async () => {
      await this.host.writeIndex(this.target, content)
      this.notice = null
      await this.loadIndex()
    })
  }

  private chooseDirectory(): void {
    void this.run(async () => {
      const picked = await this.host.pick()
      if (picked.ok) {
        if (picked.value !== null) {
          this.directory = picked.value
          this.saveDirectory()
        }
        return
      }
      if (!picked.unavailable) throw new Error(picked.message)
      // The composed picker serves the in-app browser instead of an OS chooser.
      await this.loadBrowser(undefined)
    })
  }

  private browse(path?: string): void {
    void this.run(async () => { await this.loadBrowser(path) })
  }

  private useBrowsed(): void {
    if (this.browser.kind !== 'ready') return
    this.directory = this.browser.listing.path
    this.browser = { kind: 'closed' }
    this.saveDirectory()
  }

  private refresh(): void {
    void this.run(async () => {
      this.targets = await this.loadTargets()
      this.status = await this.loadStatus()
      await this.loadIndex()
    })
  }

  private async loadTargets(): Promise<readonly MemoryTargetView[]> {
    try {
      const targets = await this.host.targets()
      // A selection the Host no longer offers (a removed workspace) would leave
      // the menu without a checked row; the report's own answer repairs it.
      return targets.length > 0 ? targets : this.targets
    } catch {
      // The picker is optional: without it the section still shows the project
      // the Host falls back to.
      return this.targets
    }
  }

  private async loadStatus(): Promise<MemoryStatusState> {
    try {
      const value = await this.host.status(this.target)
      this.target = value.target
      return { kind: 'ready', value }
    } catch (error: unknown) {
      return { kind: 'error', message: messageOf(error) }
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const index = await this.host.readIndex(this.target)
      this.index = { kind: 'ready', exists: index.exists, content: index.content, saved: index.content }
    } catch (error: unknown) {
      this.index = { kind: 'error', message: messageOf(error) }
    }
  }

  private async loadBrowser(path: string | undefined): Promise<void> {
    this.browser = { kind: 'loading' }
    this.publish()
    try {
      this.browser = { kind: 'ready', listing: await this.host.list(path) }
    } catch (error: unknown) {
      this.browser = { kind: 'error', message: messageOf(error) }
    }
  }

  /** Run one action with the section's busy state and error notice around it. */
  private async run(action: () => Promise<void>): Promise<void> {
    this.notice = null
    this.publish()
    try {
      await action()
    } catch (error: unknown) {
      this.notice = messageOf(error)
    }
    this.publish()
  }

  private canWrite(): boolean {
    return this.scope.getSnapshot().writable
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
