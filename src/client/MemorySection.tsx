/**
 * Memory settings section: the directory, its state, and the index editor.
 *
 * The page is the memory plugin's whole operator surface: it turns memory on or
 * off, points the directory at any folder (including a Claude Code `memory/`
 * directory), chooses which project's store the report and the editor describe,
 * and edits the `MEMORY.md` index a session loads.
 *
 * @module @zhang-guo-wen/dsh-memory/client/MemorySection
 */

import { useState, type ReactNode } from 'react'
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

/** The directory report the Host answered with. */
function StateBlock({ state, t }: { readonly state: MemorySectionState; readonly t: Translate }): ReactNode {
  if (state.status.kind === 'loading') return <p className={css.hint}>{t('status.loading')}</p>
  if (state.status.kind === 'error') return <p className={css.notice}>{state.status.message}</p>
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
      {state.browser.kind === 'loading' ? <p className={css.hint}>{t('status.loading')}</p> : null}
      {state.browser.kind === 'error' ? <p className={css.notice}>{state.browser.message}</p> : null}
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
            <Button variant="outline" onClick={() => { setOpen(value => !value) }}>
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
  const indexDirty = state.index.kind === 'ready' && state.index.content !== state.index.saved

  return (
    <div className={css.section}>
      <div className={css.panel}>
        <div className={css.switchRow}>
          <span className={css.switchText}>
            <span className={css.switchLabel}>{t('enable.label')}</span>
            <span className={css.switchDesc}>{t('enable.desc')}</span>
          </span>
          <Switch
            checked={state.enabled}
            onChange={value => { props.setEnabled(value) }}
            label={t('enable.label')}
            disabled={disabled}
            title={disabled ? t('unavailable') : undefined}
          />
        </div>

        <div className={css.switchRow}>
          <span className={css.switchText}>
            <span className={css.switchLabel}>{t('claude.label')}</span>
            <span className={css.switchDesc}>{t('claude.desc')}</span>
          </span>
          <Switch
            checked={state.claudeCompatible}
            onChange={value => { props.setClaudeCompatible(value) }}
            label={t('claude.label')}
            disabled={disabled}
            title={disabled ? t('unavailable') : undefined}
          />
        </div>

        {state.claudeCompatible ? null : (
          <>
            <div className={css.field}>
              <span className={css.fieldLabel}>{t('directory.label')}</span>
              <span className={css.fieldHint}>{t('directory.hint')}</span>
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
                  disabled={disabled || state.directory === state.savedDirectory}
                  onClick={() => { props.saveDirectory() }}
                >
                  {t('directory.save')}
                </Button>
                <Button variant="outline" disabled={disabled} onClick={() => { props.chooseDirectory() }}>
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

        <StateBlock state={state} t={t} />

        <div className={css.field}>
          <span className={css.fieldLabel}>{t('index.title')}</span>
          <span className={css.fieldHint}>{t('index.hint')}</span>
          <textarea
            className={css.editor}
            value={state.index.kind === 'ready' ? state.index.content : ''}
            placeholder={t('index.placeholder')}
            aria-label={t('index.title')}
            disabled={disabled || state.index.kind !== 'ready'}
            spellCheck={false}
            onChange={event => { props.editIndex(event.target.value) }}
          />
          <div className={css.actions}>
            <Button variant="primary" disabled={disabled || !indexDirty} onClick={() => { props.saveIndex() }}>
              {t('index.save')}
            </Button>
            <Button variant="ghost" disabled={disabled} onClick={() => { props.refresh() }}>
              {t('index.reload')}
            </Button>
          </div>
        </div>

        {state.notice !== null ? <p className={css.notice}>{state.notice}</p> : null}
        {disabled ? <p className={css.unavailable}>{t('unavailable')}</p> : null}
      </div>
    </div>
  )
}
