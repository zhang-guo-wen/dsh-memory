/**
 * Controller bridging the Host `memory` settings namespace and the
 * `memoryStore` Remote onto the settings section snapshot.
 *
 * The section owns one draft per writable value (the directory field and the
 * index editor) and one host report; every action commits through the
 * configuration form or the Remote and then republishes, so what the page shows
 * is what the Host holds. Every action also publishes which write is running
 * and how the last one ended, so the page can show a running, a succeeded, and
 * a failed state per action without a second source of truth.
 *
 * @module @guowenzhang/dsh-memory/client/settings-controller
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { DirectoryListing } from '@deepseek-ai/dsh-host-directory-picker/types'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { MemoryIndexView, MemoryStatusResult, MemoryTargetView } from '../types.ts'
import type { MemorySectionKey } from './locales.ts'

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

/** The write the section is running, so the controls it owns can disable themselves. */
export type MemoryBusy = '' | 'refresh' | 'directory' | 'index' | 'reload' | 'switch' | 'target' | 'browser'

/** The action a failure notice can run again. */
export type MemoryRetry = 'refresh' | 'directory' | 'index' | 'reload' | 'switch'

/**
 * How the last action ended: a dictionary key for a success (the words belong to
 * the section's locale, not to this controller) or the Host's own failure
 * sentence together with the action to run again.
 */
export type MemoryNotice =
  | { readonly tone: 'success'; readonly key: MemorySectionKey }
  | { readonly tone: 'error'; readonly message: string; readonly retry: MemoryRetry | null }

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
  /** The write currently running, or `''` when the section is idle. */
  readonly busy: MemoryBusy
  /** The last action's outcome, or null before the first one. */
  readonly notice: MemoryNotice | null
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
  /** Re-read the Host report and the index, keeping an unsaved index draft. */
  refresh(): void
  /** Re-read the index file, replacing the draft with what is on disk. */
  reloadIndex(): void
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
  /** Run the action the current failure notice reports, from the notice itself. */
  retryNotice(): void
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
  private busy: MemoryBusy = ''
  private notice: MemoryNotice | null = null
  /** The switch write a failure notice can send again, and what it should write. */
  private failedSwitch: { field: keyof MemoryFlags; value: unknown } | null = null

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
      // A settings write re-reads the report in the background: it carries no
      // busy state of its own, so the write that caused it keeps publishing the
      // running state and the outcome.
      void this.load()
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
      reloadIndex: () => { this.reloadIndex() },
      selectTarget: id => { this.selectTarget(id) },
      editIndex: value => { this.editIndex(value) },
      saveIndex: () => { this.saveIndex() },
      chooseDirectory: () => { this.chooseDirectory() },
      browse: path => { this.browse(path) },
      closeBrowser: () => { this.browser = { kind: 'closed' }; this.publish() },
      useBrowsed: () => { this.useBrowsed() },
      retryNotice: () => { this.retryNotice() },
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
      busy: this.busy,
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
    void this.run('target', () => this.load(), 'refresh')
  }

  /**
   * Commit one settings field and re-read the Host's answer.
   *
   * A Host that does not know the field — an older plugin build still loaded in
   * the process — leaves the document unchanged, so the switch must snap back to
   * what the Host actually holds instead of showing a write that never took.
   */
  private async commit(field: keyof MemoryFlags, value: unknown): Promise<void> {
    const accepted = await this.run('switch', async () => { await this.scope.set(field, value) }, 'switch')
    // A failed write leaves the switch where the Host actually is; the notice's
    // retry sends the same field again rather than making the user find it.
    this.failedSwitch = accepted ? null : { field, value }
    this.readFlags()
    this.publish()
  }

  private saveDirectory(): void {
    if (!this.canWrite()) return
    this.savedDirectory = this.directory.trim()
    this.publish()
    void this.run('directory', () => this.commitDirectory(), 'directory')
  }

  /** Write the directory field's committed value, and report the accepted write. */
  private async commitDirectory(): Promise<void> {
    const accepted = await this.scope.set('directory', this.savedDirectory)
    if (accepted) this.notice = { tone: 'success', key: 'notice.directorySaved' }
  }

  private editIndex(content: string): void {
    if (this.index.kind !== 'ready') return
    this.index = { ...this.index, content }
    this.publish()
  }

  private saveIndex(): void {
    if (this.index.kind !== 'ready' || !this.canWrite()) return
    const content = this.index.content
    void this.run('index', async () => {
      await this.host.writeIndex(this.target, content)
      this.notice = { tone: 'success', key: 'notice.indexSaved' }
      await this.loadIndex(true)
    }, 'index')
  }

  /** Read the index file, replacing the draft with what is on disk. */
  private reloadIndex(): void {
    void this.run('reload', () => this.loadIndex(false), 'reload')
  }

  private chooseDirectory(): void {
    void this.run('browser', async () => {
      const picked = await this.host.pick()
      if (picked.ok) {
        if (picked.value !== null) {
          this.directory = picked.value
          this.savedDirectory = picked.value.trim()
          await this.commitDirectory()
        }
        return
      }
      if (!picked.unavailable) throw new Error(picked.message)
      // The composed picker serves the in-app browser instead of an OS chooser.
      await this.loadBrowser(undefined)
    })
  }

  private browse(path?: string): void {
    void this.run('browser', async () => { await this.loadBrowser(path) }, null)
  }

  private useBrowsed(): void {
    if (this.browser.kind !== 'ready') return
    this.directory = this.browser.listing.path
    this.browser = { kind: 'closed' }
    this.saveDirectory()
  }

  private refresh(): void {
    void this.run('refresh', () => this.load(), 'refresh')
  }

  /** Run the action the current failure notice reports. */
  private retryNotice(): void {
    const retry = this.notice?.tone === 'error' ? this.notice.retry : null
    if (retry === 'refresh') this.refresh()
    else if (retry === 'directory') this.saveDirectory()
    else if (retry === 'index') this.saveIndex()
    else if (retry === 'reload') this.reloadIndex()
    else if (retry === 'switch' && this.failedSwitch !== null) {
      void this.commit(this.failedSwitch.field, this.failedSwitch.value)
    }
  }

  /** Read the picker, the report, and the index. */
  private async load(): Promise<void> {
    this.targets = await this.loadTargets()
    await this.loadStatus()
    await this.loadIndex(true)
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

  /**
   * Read the report.
   *
   * A read that fails keeps the last report on screen and reports the failure as
   * a notice, so a gateway that hiccups once does not replace what the account
   * already knows with an error page; only a read with nothing to show leaves
   * the block in its error state.
   */
  private async loadStatus(): Promise<void> {
    try {
      const value = await this.host.status(this.target)
      this.target = value.target
      this.status = { kind: 'ready', value }
    } catch (error: unknown) {
      if (this.status.kind !== 'ready') this.status = { kind: 'error', message: messageOf(error) }
      this.notice = { tone: 'error', message: messageOf(error), retry: 'refresh' }
    }
  }

  /**
   * Read the index file.
   * @param keepDirty - keep an edited draft (a refresh) instead of replacing it
   * with the file's content (the explicit reload).
   */
  private async loadIndex(keepDirty: boolean): Promise<void> {
    try {
      const file = await this.host.readIndex(this.target)
      const previous = this.index
      const draft = keepDirty && previous.kind === 'ready' && previous.content !== previous.saved
        ? previous.content
        : file.content
      this.index = { kind: 'ready', exists: file.exists, content: draft, saved: file.content }
    } catch (error: unknown) {
      // Keep the last good draft: a failed re-read must not look like an empty
      // index, and the reload control re-runs the read.
      if (this.index.kind !== 'ready') this.index = { kind: 'error', message: messageOf(error) }
      this.notice = { tone: 'error', message: messageOf(error), retry: 'reload' }
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

  /**
   * Run one action with the section's busy state and outcome around it.
   * @param kind - the write the controls disable themselves for while it runs.
   * @param action - the Host work.
   * @param retry - the action a failure notice runs again, or null when the
   * control that started it is still on screen as its own retry.
   * @returns whether the action completed without throwing.
   */
  private async run(kind: MemoryBusy, action: () => Promise<void>, retry: MemoryRetry | null = null): Promise<boolean> {
    this.busy = kind
    this.notice = null
    this.publish()
    try {
      await action()
      return true
    } catch (error: unknown) {
      this.notice = { tone: 'error', message: messageOf(error), retry }
      return false
    } finally {
      this.busy = ''
      this.publish()
    }
  }

  private canWrite(): boolean {
    return this.scope.getSnapshot().writable
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
