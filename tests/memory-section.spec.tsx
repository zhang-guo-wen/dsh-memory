import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemorySection, type MemorySectionProps } from '../src/client/MemorySection.tsx'
import { en, zh, type MemorySectionKey } from '../src/client/locales.ts'
import type { MemorySectionState } from '../src/client/settings-controller.ts'

const READY: MemorySectionState = {
  available: true,
  writable: true,
  enabled: true,
  claudeCompatible: false,
  directory: '~/.claude/projects/{project}/memory',
  savedDirectory: '~/.claude/projects/{project}/memory',
  status: {
    kind: 'ready',
    value: {
      enabled: true,
      claudeCompatible: false,
      target: 'current',
      configured: '~/.claude/projects/{project}/memory',
      directory: '/home/u/.claude/projects/-home-u-repo/memory',
      projectScoped: true,
      exists: true,
      index: {
        path: '/memories/MEMORY.md',
        bytes: 2048,
        lines: 12,
        limitLines: 200,
        limitBytes: 25_600,
        truncated: false,
      },
      files: [
        { path: '/memories/MEMORY.md', bytes: 2048, modifiedMs: 0 },
        { path: '/memories/debugging.md', bytes: 512, modifiedMs: 0 },
      ],
      totalBytes: 2560,
      maxFileBytes: 1_048_576,
    },
  },
  index: { kind: 'ready', exists: true, content: '- [Debugging](debugging.md) — tokens\n', saved: '- [Debugging](debugging.md) — tokens\n' },
  browser: { kind: 'closed' },
  targets: [
    { id: 'current', label: 'deepseek-harness', detail: '/repo', directory: '/repo/.dsh/memory/-repo', exists: true },
    { id: 'workspace:w2', label: 'nocobase', detail: '/work/nocobase', directory: '/home/u/.dsh/memory/-work-nocobase', exists: false },
  ],
  target: 'current',
  busy: '',
  notice: null,
}

/** Render the section with a real dictionary and a fixed snapshot. */
function render(locale: 'zh' | 'en', state: Partial<MemorySectionState> = {}): string {
  const dictionary = locale === 'zh' ? zh : en
  const snapshot: MemorySectionState = { ...READY, ...state }
  const props = {
    t: (key: MemorySectionKey, params?: Record<string, unknown>) => {
      const template = dictionary[key]
      if (params === undefined) return template
      return template.replace(/\{(\w+)\}/g, (match, name: string) => (
        name in params ? String(params[name]) : match
      ))
    },
    useMemory: (selector: (value: MemorySectionState) => unknown) => selector(snapshot),
    setEnabled: () => {},
    setClaudeCompatible: () => {},
    editDirectory: () => {},
    saveDirectory: () => {},
    refresh: () => {},
    reloadIndex: () => {},
    selectTarget: () => {},
    editIndex: () => {},
    saveIndex: () => {},
    chooseDirectory: () => {},
    browse: () => {},
    closeBrowser: () => {},
    useBrowsed: () => {},
    retryNotice: () => {},
  } as unknown as MemorySectionProps
  return renderToStaticMarkup(<MemorySection {...props} />)
}

/** React escapes the text it renders, so compare against escaped copy. */
function escaped(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

describe('memory settings section', () => {
  it('presents both switches, the directory field, and the index editor', () => {
    const html = render('zh')
    expect(html.match(/role="switch"/g)).toHaveLength(2)
    expect(html).toContain(escaped(zh['claude.label']))
    expect(html).toContain(`value="${escaped(READY.directory)}"`)
    expect(html).toContain('<textarea')
    expect(html).toContain(escaped('- [Debugging](debugging.md) — tokens'))
  })

  it('drops the directory field while Claude\'s own directory is used', () => {
    const html = render('zh', { claudeCompatible: true })
    expect(html).not.toContain(escaped(zh['directory.choose']))
    expect(html).not.toContain('<input')
    expect(html).toContain(escaped(zh['claude.label']))
  })

  it('offers the projects the Host can show', () => {
    const html = render('zh')
    expect(html).toContain(escaped(zh['targets.label']))
    expect(html).toContain(escaped(zh['targets.hint']))
    // The trigger names the selected project.
    expect(html).toContain('deepseek-harness')
    // One project means nothing to choose, so the picker stays away.
    const single = render('zh', { targets: [READY.targets[0]!] })
    expect(single).not.toContain(escaped(zh['targets.hint']))
  })

  it('reports what the Host resolved and holds', () => {
    const html = render('zh')
    // The field holds a template; the state block names the resolved directory,
    // so the two are never read as the same thing.
    expect(html).toContain(escaped(zh['directory.label']))
    expect(html).toContain(escaped(zh['status.resolved']))
    expect(html).toContain(escaped('/home/u/.claude/projects/-home-u-repo/memory'))
    expect(html).toContain('12')
    expect(html).toContain('2.0K')
    expect(html).toContain(escaped('2 个 · 合计 2.5K'))
    expect(html).toContain(escaped(zh['status.cap']))
    expect(html).not.toContain('{size}')
  })

  it('warns when the index exceeds what a session loads', () => {
    const ready = READY.status
    const html = render('en', {
      status: ready.kind === 'ready'
        ? { kind: 'ready', value: { ...ready.value, index: { ...ready.value.index!, truncated: true } } }
        : ready,
    })
    expect(html).toContain(escaped('Over the session load limit'))
  })

  it('renders the directory browser once the Host answers with a level', () => {
    const html = render('zh', {
      browser: {
        kind: 'ready',
        listing: {
          path: '/home/u',
          home: '/home/u',
          crumbs: [{ name: '/', path: '/', hidden: false }, { name: 'u', path: '/home/u', hidden: false }],
          entries: [{ name: '.claude', path: '/home/u/.claude', hidden: true }],
          truncated: false,
        },
      },
    })
    expect(html).toContain(escaped(zh['browser.title']))
    expect(html).toContain(escaped(zh['browser.use']))
    expect(html).toContain('.claude')
  })

  it('renders the empty state without an index file', () => {
    const html = render('zh', { index: { kind: 'ready', exists: false, content: '', saved: '' } })
    expect(html).toContain(escaped(zh['index.placeholder']))
    expect(html).toContain('disabled=""')
  })

  it('disables every control when the namespace is not writable', () => {
    const html = render('zh', { available: false, writable: false })
    expect(html).toContain(escaped(zh.unavailable))
    expect(html).toContain('disabled=""')
  })

  it('shows the report skeleton while the first read is in flight', () => {
    const html = render('zh', { status: { kind: 'loading' }, index: { kind: 'loading' } })
    // Both first reads announce themselves, and the editor is a placeholder of
    // its own size rather than an empty enabled field.
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain(escaped(zh['status.loading']))
    expect(html).not.toContain('<textarea')
  })

  it('reports a failed report read with the reason and a retry', () => {
    const html = render('zh', { status: { kind: 'error', message: 'connect ECONNREFUSED' } })
    expect(html).toContain(escaped(zh['status.error']))
    expect(html).toContain('connect ECONNREFUSED')
    expect(html).toContain(escaped(zh.retry))
    expect(html).toContain('role="alert"')
  })

  it('reports a failed index read instead of an empty editor', () => {
    const html = render('zh', { index: { kind: 'error', message: 'EACCES' } })
    expect(html).toContain(escaped(zh['index.loadFailed']))
    expect(html).toContain('EACCES')
    expect(html).not.toContain('<textarea')
    // The reload control is what reads the file again.
    expect(html).toContain(escaped(zh['index.reload']))
  })

  it('names the running write on the control that started it', () => {
    expect(render('zh', { busy: 'directory' })).toContain(escaped(zh.saving))
    expect(render('zh', { busy: 'reload' })).toContain(escaped(zh.refreshing))
  })

  it('reports the last action: a saved line, or the reason and a retry', () => {
    const saved = render('zh', { notice: { tone: 'success', key: 'notice.indexSaved' } })
    expect(saved).toContain(escaped(zh['notice.indexSaved']))
    expect(saved).toContain('role="status"')

    const failed = render('zh', {
      notice: { tone: 'error', message: 'EACCES: permission denied', retry: 'index' },
    })
    expect(failed).toContain(escaped(zh['error.action']))
    expect(failed).toContain('EACCES: permission denied')
    expect(failed).toContain(escaped(zh.retry))
    expect(failed).toContain('role="alert"')

    // A failure whose control is still on screen carries no retry of its own.
    const noRetry = render('zh', { notice: { tone: 'error', message: 'nope', retry: null } })
    expect(noRetry).toContain('nope')
    expect(noRetry).not.toContain(escaped(zh.retry))
  })

  it('marks the directory field while its draft is unsaved', () => {
    const dirty = render('zh', { directory: '~/memory/{project}', savedDirectory: '~/other' })
    expect(dirty).toContain(escaped(zh['directory.unsaved']))
    expect(render('zh')).not.toContain(escaped(zh['directory.unsaved']))
  })

  it('says what to do when the browsed directory has no subdirectories', () => {
    const html = render('zh', {
      browser: {
        kind: 'ready',
        listing: { path: '/home/u', home: '/home/u', crumbs: [], entries: [], truncated: false },
      },
    })
    expect(html).toContain(escaped(zh['browser.empty']))
  })

  it('keeps both dictionaries in step', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(Object.values(en).every(value => value.length > 0)).toBe(true)
    expect(Object.values(zh).every(value => value.length > 0)).toBe(true)
  })
})
