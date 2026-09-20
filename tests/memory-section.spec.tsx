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
    editIndex: () => {},
    saveIndex: () => {},
    chooseDirectory: () => {},
    browse: () => {},
    closeBrowser: () => {},
    useBrowsed: () => {},
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

  it('reports what the Host resolved and holds', () => {
    const html = render('zh')
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

  it('keeps both dictionaries in step', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(Object.values(en).every(value => value.length > 0)).toBe(true)
    expect(Object.values(zh).every(value => value.length > 0)).toBe(true)
  })
})
