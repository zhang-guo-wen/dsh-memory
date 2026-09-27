import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { MemoryPathError, memoryDisplayPath, resolveMemoryPath } from '../src/paths.ts'
import { MEMORY_INDEX_NAME, MemoryStore } from '../src/store.ts'

/** A fixed absolute root, spelled the way this platform spells it. */
const ROOT = resolve('/memory-root')

async function tempRoot(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'dsh-memory-store-'))
}

describe('resolveMemoryPath', () => {
  it('addresses the root and its entries through /memories', () => {
    expect(resolveMemoryPath(ROOT, '/memories')).toBe(ROOT)
    expect(resolveMemoryPath(ROOT, '/memories/notes.md')).toBe(join(ROOT, 'notes.md'))
    expect(resolveMemoryPath(ROOT, 'notes/deep.md')).toBe(join(ROOT, 'notes', 'deep.md'))
    expect(resolveMemoryPath(ROOT, 'memories/notes.md')).toBe(join(ROOT, 'notes.md'))
  })

  it('refuses a path that leaves the memory root', () => {
    expect(() => resolveMemoryPath(ROOT, '/etc/passwd')).toThrow(MemoryPathError)
    expect(() => resolveMemoryPath(ROOT, '../outside.md')).toThrow(MemoryPathError)
    expect(() => resolveMemoryPath(ROOT, '/memories/../../outside.md')).toThrow(MemoryPathError)
    expect(() => resolveMemoryPath(ROOT, 'C:/windows/system32')).toThrow(MemoryPathError)
  })

  it('reports Claude\'s refusal text for the refused path', () => {
    expect(() => resolveMemoryPath(ROOT, '/etc/passwd')).toThrow(
      'Path must start with /memories, got: /etc/passwd',
    )
  })

  it('renders absolute paths back as model-facing paths', () => {
    expect(memoryDisplayPath(ROOT, ROOT)).toBe('/memories')
    expect(memoryDisplayPath(ROOT, join(ROOT, 'a', 'b.md'))).toBe('/memories/a/b.md')
  })
})

describe('MemoryStore view', () => {
  it('numbers the lines of a file', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.create('/memories/notes.md', 'first\nsecond\n')
    expect(await store.view('/memories/notes.md')).toBe(
      "Here's the content of /memories/notes.md with line numbers:\n     1\tfirst\n     2\tsecond",
    )
  })

  it('honours a view range, with -1 meaning end of file', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.create('/memories/notes.md', 'a\nb\nc\nd')
    expect(await store.view('/memories/notes.md', [2, -1])).toContain('     2\tb\n     3\tc\n     4\td')
    expect(await store.view('/memories/notes.md', [3, 3])).toContain('     3\tc')
    expect(await store.view('/memories/notes.md', [9, 12])).toContain('Invalid `view_range` parameter')
  })

  it('answers a missing path with the memory tool wording', async () => {
    const store = new MemoryStore(await tempRoot())
    expect(await store.view('/memories/nope.md')).toBe(
      'Error: The path /memories/nope.md does not exist. Please provide a valid path.',
    )
  })

  it('lists a directory two levels deep and hides dot entries', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.create('/memories/MEMORY.md', '- [Notes](notes.md) — hooks\n')
    await store.create('/memories/topic/one.md', 'one')
    await store.create('/memories/topic/deep/two.md', 'two')
    await mkdir(join(root, '.hidden'), { recursive: true })
    await writeFile(join(root, '.hidden', 'secret.md'), 'secret')
    await mkdir(join(root, 'node_modules'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'dep.md'), 'dep')

    const listing = await store.view('/memories')
    expect(listing).toContain('excluding hidden items:')
    expect(listing).toContain('/memories/MEMORY.md')
    expect(listing).toContain('/memories/topic/one.md')
    expect(listing).toContain('/memories/topic/deep')
    // Two levels deep: a grandchild directory is listed, its own children are not.
    expect(listing).not.toContain('two.md')
    expect(listing).not.toContain('.hidden')
    expect(listing).not.toContain('node_modules')
  })

  it('renders an empty directory without rows', async () => {
    const root = await tempRoot()
    await mkdir(root, { recursive: true })
    expect(await new MemoryStore(root).view('/memories')).toContain('(empty)')
  })
})

describe('MemoryStore write commands', () => {
  it('creates a file, including its parent directories', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    expect(await store.create('/memories/topic/one.md', 'one')).toBe(
      'File created successfully at: /memories/topic/one.md',
    )
    expect(await readFile(join(root, 'topic', 'one.md'), { encoding: 'utf8' })).toBe('one')
  })

  it('refuses to create over an existing file', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.create('/memories/one.md', 'one')
    expect(await store.create('/memories/one.md', 'two')).toBe('Error: File /memories/one.md already exists')
  })

  it('replaces a unique string and reports the edited window', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.create('/memories/one.md', 'alpha\nbeta\ngamma\n')
    const reply = await store.strReplace('/memories/one.md', 'beta', 'BETA')
    expect(reply).toContain('The memory file has been edited.')
    expect(reply).toContain('BETA')
    expect(await readFile(join(root, 'one.md'), { encoding: 'utf8' })).toBe('alpha\nBETA\ngamma\n')
  })

  it('refuses a string that does not appear, and one that appears twice', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.create('/memories/one.md', 'alpha\nbeta\nalpha\n')
    expect(await store.strReplace('/memories/one.md', 'gamma', 'x')).toBe(
      'No replacement was performed, old_str `gamma` did not appear verbatim in /memories/one.md.',
    )
    expect(await store.strReplace('/memories/one.md', 'alpha', 'x')).toBe(
      'No replacement was performed. Multiple occurrences of old_str `alpha` in lines: 1, 3. Please ensure it is unique',
    )
  })

  it('reports a missing file for an edit', async () => {
    const store = new MemoryStore(await tempRoot())
    expect(await store.strReplace('/memories/gone.md', 'a', 'b')).toBe(
      'Error: The path /memories/gone.md does not exist. Please provide a valid path.',
    )
    expect(await store.insert('/memories/gone.md', 0, 'a')).toBe(
      'Error: The path /memories/gone.md does not exist. Please provide a valid path.',
    )
  })

  it('inserts at a 0-based line and rejects an out-of-range index', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.create('/memories/one.md', 'a\nb')
    expect(await store.insert('/memories/one.md', 1, 'mid')).toBe('The file /memories/one.md has been edited.')
    expect(await readFile(join(root, 'one.md'), { encoding: 'utf8' })).toBe('a\nmid\nb')
    expect(await store.insert('/memories/one.md', 9, 'x')).toBe(
      'Error: Invalid `insert_line` parameter: 9. It should be within the range of lines of the file: [0, 3]',
    )
  })

  it('deletes a file, a directory tree, and refuses the root', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.create('/memories/topic/one.md', 'one')
    expect(await store.delete('/memories/topic')).toBe('Successfully deleted /memories/topic')
    expect(await store.view('/memories/topic')).toContain('does not exist')
    expect(await store.delete('/memories')).toBe('Cannot delete the /memories directory itself')
  })

  it('renames an entry and refuses an existing destination', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.create('/memories/one.md', 'one')
    await store.create('/memories/two.md', 'two')
    expect(await store.rename('/memories/one.md', '/memories/renamed.md')).toBe(
      'Successfully renamed /memories/one.md to /memories/renamed.md',
    )
    expect(await store.rename('/memories/renamed.md', '/memories/two.md')).toBe(
      'Error: The destination /memories/two.md already exists',
    )
    expect(await store.rename('/memories/gone.md', '/memories/x.md')).toBe(
      'Error: The path /memories/gone.md does not exist',
    )
  })

  it('refuses a write that escapes the root', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await expect(store.create('/etc/passwd', 'x')).rejects.toThrow(MemoryPathError)
  })

  it('enforces the per-file byte cap', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root, { maxFileBytes: 4 })
    expect(await store.create('/memories/big.md', '12345')).toContain('file limit')
    expect(await store.create('/memories/ok.md', '1234')).toContain('File created successfully')
  })
})

describe('MemoryStore index', () => {
  it('reads the index whole and cut to the session limits', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    const body = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join('\n')
    await store.writeIndex(body)

    const whole = await store.readIndexSource()
    expect(whole?.lines).toBe(10)
    expect(whole?.bytes).toBe(Buffer.byteLength(body, 'utf8'))

    const cut = await store.readIndex(4, 1024)
    expect(cut?.content.split('\n')).toHaveLength(4)
    expect(cut?.lines).toBe(10)
    expect(cut?.truncated).toBe(true)

    const whole2 = await store.readIndex(200, 25_600)
    expect(whole2?.truncated).toBe(false)
  })

  it('reports no index before one exists', async () => {
    const store = new MemoryStore(await tempRoot())
    expect(await store.readIndexSource()).toBeUndefined()
    expect(await store.readIndex()).toBeUndefined()
  })

  it('creates the memory directory on the first index write', async () => {
    const root = join(await tempRoot(), 'nested', 'memory')
    const store = new MemoryStore(root)
    expect(await store.writeIndex('# Memory Index\n')).toEqual({ bytes: 15, lines: 1 })
    expect(await readFile(join(root, MEMORY_INDEX_NAME), { encoding: 'utf8' })).toBe('# Memory Index\n')
  })

  it('lists the directory files in name order', async () => {
    const root = await tempRoot()
    const store = new MemoryStore(root)
    await store.create('/memories/MEMORY.md', 'index')
    await store.create('/memories/topic/b.md', 'b')
    await store.create('/memories/topic/a.md', 'a')
    expect((await store.listFiles()).map(row => row.path)).toEqual([
      '/memories/MEMORY.md',
      '/memories/topic/a.md',
      '/memories/topic/b.md',
    ])
  })
})
