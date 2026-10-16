/**
 * Memory settings section: the directory, its state, and the index editor.
 *
 * The page is the memory plugin's whole operator surface: it turns memory on or
 * off, points the directory at any folder (including a Claude Code `memory/`
 * directory), chooses which project's store the report and the editor describe,
 * and edits the `MEMORY.md` index a session loads. Every write reports which
 * action is running and how the last one ended, so a slow Host is visible and a
 * failure keeps both the data and a way to run the action again.
 *
 * @module @guowenzhang/dsh-memory/client/MemorySection
 */

import { useState, type MouseEvent, type ReactNode } from 'react'
import { Button, Input, Menu, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DirectoryListing } from '@deepseek-ai/dsh-host-directory-picker/types'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MemorySectionFace, MemorySectionState } from './settings-controller.ts'
import css from './MemorySection.module.css'

/** Full component props. */
export type MemorySectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.memory'>
  & InjectFace<MemorySectionFace>

/** Localized `t` bound to this section's dictionary namespace. */
type Translate = MemorySectionProps['t']

/**
 * CSS-module class lookup for props TypeScript types as strictly `string`:
 * `noUncheckedIndexedAccess` widens every module class to `string | undefined`.
 */
const cls = (name: string): string => css[name] ?? ''

/** Human-readable byte size for the state rows. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

/** One label/value row of the store report. */
function StateRow({ label, value, title }: {
  readonly label: string
  readonly value: ReactNode
  readonly title?: string | undefined
}): ReactNode {
  return (
    <div className={css.stateRow} title={title}>
      <span className={css.stateKey}>{label}</span>
      <span className={css.stateValue}>{value}</span>
    </div>
  )
}

/**
 * One switch with its copy: the row is a press area in its own right, because
 * the host's control is 36x20 and a finger misses it on a phone. A press that
 * lands on a control keeps that control's own behaviour.
 */
function SwitchRow({ label, desc, checked, disabled, title, onChange }: {
  readonly label: string
  readonly desc: string
  readonly checked: boolean
  readonly disabled: boolean
  readonly title: string | undefined
  readonly onChange: (value: boolean) => void
}): ReactNode {
  const press = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target instanceof HTMLElement && event.target.closest('button, input, select, textarea, a') !== null) return
    if (!disabled) onChange(!checked)
  }
  return (
    <div className={css.switchRow} onClick={press}>
      <span className={css.switchText}>
        <span className={css.switchLabel}>{label}</span>
        <span className={css.switchDesc}>{desc}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} title={title} />
    </div>
  )
}

/** First read of the report, in the place its rows will occupy. */
function StateSkeleton({ t }: { readonly t: Translate }): ReactNode {
  return (
    <div className={css.skeleton} role="status" aria-busy="true" aria-label={t('status.loading')}>
      {[0, 1, 2, 3].map(index => <span key={index} className={css.skeletonRow} aria-hidden="true" />)}
    </div>
  )
}

/** The directory report the Host answered with. */
function StateBlock({ state, t, retry }: {
  readonly state: MemorySectionState
  readonly t: Translate
  readonly retry: () => void
}): ReactNode {
  if (state.status.kind === 'loading') return <StateSkeleton t={t} />
  // A read with nothing to show: the sentence, the Host's reason, and the read
  // again. A read that failed with a report already on screen keeps that report
  // and reports itself as the action notice instead.
  if (state.status.kind === 'error') {
    return <div className={css.errorRow} role="alert">
      <p>{t('status.error')}<span className={css.errorReason}>{` · ${state.status.message}`}</span></p>
      <Button variant="outline" disabled={state.busy !== ''} onClick={retry}>{t('retry')}</Button>
    </div>
  }
  const report = state.status.value
  const index = report.index
  return (
    <div className={css.state}>
      <StateRow label={t('status.resolved')} value={<code className={css.path}>{report.directory}</code>} />
      <StateRow
        label={t('status.title')}
        value={report.exists ? t('status.exists') : t('status.missing')}
      />
      <StateRow
        label={t('status.index')}
        value={index === null
          ? t('status.indexMissing')
          : t('status.indexSize', { lines: index.lines, size: formatSize(index.bytes) })}
      />
      <StateRow
        label={t('status.files')}
        value={t('status.filesValue', { count: report.files.length, size: formatSize(report.totalBytes) })}
      />
      <StateRow label={t('status.cap')} value={formatSize(report.maxFileBytes)} />
      {index?.truncated === true
        ? <p className={css.notice}>{t('status.truncated', { lines: index.limitLines, bytes: index.limitBytes })}</p>
        : null}
    </div>
  )
}

/** The in-app directory browser, shown when the composed picker has no OS chooser. */
function Browser({ state, t, browse, use, close }: {
  readonly state: MemorySectionState
  readonly t: Translate
  readonly browse: (path?: string) => void
  readonly use: () => void
  readonly close: () => void
}): ReactNode {
  if (state.browser.kind === 'closed') return null
  const cancel = (
    <div className={css.actions}>
      <Button variant="ghost" onClick={close}>{t('browser.cancel')}</Button>
    </div>
  )
  return (
    <div className={css.browser}>
      <span className={css.fieldLabel}>{t('browser.title')}</span>
      {state.browser.kind === 'loading' ? (
        <div className={css.skeleton} role="status" aria-busy="true" aria-label={t('status.loading')}>
          {[0, 1, 2].map(index => <span key={index} className={css.skeletonRow} aria-hidden="true" />)}
        </div>
      ) : null}
      {state.browser.kind === 'error' ? <p className={css.notice} role="alert">{state.browser.message}</p> : null}
      {state.browser.kind === 'ready' ? (
        <BrowserListing
          listing={state.browser.listing}
          t={t}
          browse={browse}
          use={use}
          close={close}
        />
      ) : null}
      {state.browser.kind === 'loading' || state.browser.kind === 'error' ? cancel : null}
    </div>
  )
}

/** One browse level: its path, its child directories, and the way back up. */
function BrowserListing({ listing, t, browse, use, close }: {
  readonly listing: DirectoryListing
  readonly t: Translate
  readonly browse: (path?: string) => void
  readonly use: () => void
  readonly close: () => void
}): ReactNode {
  return (
    <>
      <code className={css.path}>{t('browser.here', { path: listing.path })}</code>
      {listing.entries.length === 0
        ? <p className={css.hint}>{t('browser.empty')}</p>
        : (
          <div className={css.browserList}>
            {listing.entries.map(entry => (
              <button
                key={entry.path}
                type="button"
                className={css.browserEntry}
                onClick={() => { browse(entry.path) }}
              >
                {entry.name}
              </button>
            ))}
          </div>
        )}
      <div className={css.actions}>
        <Button variant="primary" onClick={use}>{t('browser.use')}</Button>
        <Button variant="outline" onClick={() => { browse(parentOf(listing)) }}>{t('browser.parent')}</Button>
        <Button variant="ghost" onClick={close}>{t('browser.cancel')}</Button>
      </div>
    </>
  )
}

/** The listing's parent directory, or the listing itself at the filesystem root. */
function parentOf(listing: DirectoryListing): string {
  const parent = listing.crumbs.at(-2)
  return parent?.path ?? listing.path
}

/** The project picker: one menu row per store the Host can show. */
function TargetPicker({ state, t, select }: {
  readonly state: MemorySectionState
  readonly t: Translate
  readonly select: (id: string) => void
}): ReactNode {
  const [open, setOpen] = useState(false)
  if (state.targets.length < 2) return null
  const selected = state.targets.find(target => target.id === state.target)
  return (
    <div className={css.field}>
      <span className={css.fieldLabel}>{t('targets.label')}</span>
      <span className={css.fieldHint}>{t('targets.hint')}</span>
      <div className={css.actions}>
        <Menu
          open={open}
          anchor={(
            <Button variant="outline" disabled={state.busy !== ''} onClick={() => { setOpen(value => !value) }}>
              {selected?.label ?? t('targets.current')}
            </Button>
          )}
          items={state.targets.map(target => ({ id: target.id, label: target.label }))}
          selectedId={state.target}
          onSelect={(id) => {
            setOpen(false)
            select(id)
          }}
          onClose={() => { setOpen(false) }}
          portal
        />
      </div>
    </div>
  )
}

/** The settings section body. */
export function MemorySection(props: MemorySectionProps): ReactNode {
  const { useMemory, t } = props
  const state = useMemory(snapshot => snapshot)
  const disabled = !state.available || !state.writable
  const idle = disabled || state.busy !== ''
  const indexDirty = state.index.kind === 'ready' && state.index.content !== state.index.saved

  return (
    <div className={css.section}>
      <div className={css.panel}>
        <SwitchRow
          label={t('enable.label')}
          desc={t('enable.desc')}
          checked={state.enabled}
          disabled={idle}
          title={disabled ? t('unavailable') : undefined}
          onChange={value => { props.setEnabled(value) }}
        />

        <SwitchRow
          label={t('claude.label')}
          desc={t('claude.desc')}
          checked={state.claudeCompatible}
          disabled={idle}
          title={disabled ? t('unavailable') : undefined}
          onChange={value => { props.setClaudeCompatible(value) }}
        />

        {state.claudeCompatible ? null : (
          <>
            <div className={css.field}>
              <span className={css.fieldLabel}>{t('directory.label')}</span>
              <span className={css.fieldHint}>
                {t('directory.hint')}
                {state.directory !== state.savedDirectory
                  ? <span className={css.unsaved}>{` · ${t('directory.unsaved')}`}</span>
                  : null}
              </span>
              <div className={css.actions}>
                <Input
                  className={cls('input')}
                  value={state.directory}
                  placeholder={t('directory.placeholder')}
                  aria-label={t('directory.label')}
                  disabled={disabled}
                  onChange={event => { props.editDirectory(event.target.value) }}
                />
                <Button
                  variant="outline"
                  disabled={idle || state.directory === state.savedDirectory}
                  onClick={() => { props.saveDirectory() }}
                >
                  {t(state.busy === 'directory' ? 'saving' : 'directory.save')}
                </Button>
                <Button variant="outline" disabled={idle} onClick={() => { props.chooseDirectory() }}>
                  {t('directory.choose')}
                </Button>
              </div>
            </div>

            <Browser
              state={state}
              t={t}
              browse={props.browse}
              use={props.useBrowsed}
              close={props.closeBrowser}
            />
          </>
        )}

        <TargetPicker state={state} t={t} select={props.selectTarget} />

        <StateBlock state={state} t={t} retry={() => { props.refresh() }} />

        <div className={css.field}>
          <span className={css.fieldLabel}>{t('index.title')}</span>
          <span className={css.fieldHint}>{t('index.hint')}</span>
          {state.index.kind === 'loading' ? (
            <span className={css.skeletonEditor} role="status" aria-busy="true" aria-label={t('status.loading')} />
          ) : null}
          {/* The draft could not be read: the file is not shown as empty, and the
              reload control below re-reads it. */}
          {state.index.kind === 'error' ? (
            <div className={css.errorRow} role="alert">
              <p>{t('index.loadFailed')}<span className={css.errorReason}>{` · ${state.index.message}`}</span></p>
            </div>
          ) : null}
          {state.index.kind === 'ready' ? (
            <textarea
              className={css.editor}
              value={state.index.content}
              placeholder={t('index.placeholder')}
              aria-label={t('index.title')}
              disabled={disabled}
              spellCheck={false}
              onChange={event => { props.editIndex(event.target.value) }}
            />
          ) : null}
          <div className={css.actions}>
            <Button variant="primary" disabled={idle || !indexDirty} onClick={() => { props.saveIndex() }}>
              {t(state.busy === 'index' ? 'saving' : 'index.save')}
            </Button>
            <Button variant="ghost" disabled={idle} onClick={() => { props.reloadIndex() }}>
              {t(state.busy === 'reload' ? 'refreshing' : 'index.reload')}
            </Button>
          </div>
        </div>

        {/* The last action's outcome: what it was, why it failed, and the action
            again. A failure keeps the data above it untouched. */}
        {state.notice !== null ? (
          <div className={css.noticeRow}>
            <p
              className={css.notice}
              data-tone={state.notice.tone}
              role={state.notice.tone === 'error' ? 'alert' : 'status'}
            >
              {state.notice.tone === 'success' ? t(state.notice.key) : t('error.action')}
              {state.notice.tone === 'error'
                ? <span className={css.errorReason}>{` · ${state.notice.message}`}</span>
                : null}
            </p>
            {state.notice.tone === 'error' && state.notice.retry !== null ? (
              <Button variant="outline" disabled={idle} onClick={() => { props.retryNotice() }}>{t('retry')}</Button>
            ) : null}
          </div>
        ) : null}
        {disabled ? <p className={css.unavailable}>{t('unavailable')}</p> : null}
      </div>
    </div>
  )
}
