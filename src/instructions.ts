/**
 * The memory contributor: what the model is told about its memory directory.
 *
 * Claude loads the memory index into every session and describes the memory
 * protocol beside it, so this plugin folds one `instructions` message — the
 * protocol text plus the current `MEMORY.md` — into the first request that
 * carries a user message. The message is recorded on the Session log under this
 * plugin's own source kind, so a resumed Session that already carries it is not
 * given it twice.
 *
 * @module @guowenzhang/dsh-memory/instructions
 */

import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextFormed, MessageSource, UserMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import { MEMORY_INDEX_NAME, MemoryStore, type MemoryIndex } from './store.ts'
import { MEMORY_PATH_PREFIX } from './paths.ts'
import type { MemoryRuntime } from './settings.ts'

/** Package identity recorded on every injected message this plugin produces. */
export const PLUGIN_ID = '@guowenzhang/dsh-memory'

/** Loader name this plugin's one contributor records. */
export const MEMORY_LOADER = 'memory-index'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'plugin:@guowenzhang/dsh-memory#memory-index':
      { kind: 'plugin:@guowenzhang/dsh-memory#memory-index' } & ContextFormed
  }
}

/**
 * The source for the memory instructions message: this plugin's own kind, which
 * names the contributor the transcript shows, carrying the instructions form.
 *
 * The harness retired the generic `{ kind: 'plugin', plugin }` wrapper — a
 * durable row that still names it is refused — so a producer declares its own
 * kind. Its spelling is the one the conversion of that retired record writes, so
 * a Session resumed across the conversion and one written now agree on one
 * identity.
 * @returns an instructions-form model source owned by this plugin.
 */
export function memorySource(): MessageSource {
  return { kind: `plugin:${PLUGIN_ID}#${MEMORY_LOADER}`, form: 'instructions' }
}

/**
 * Whether one logged message source came from this plugin's memory contributor.
 *
 * The retired generic `plugin` wrapper this plugin wrote before that kind
 * existed still answers yes, so a Session resumed from an older log is not given
 * the same index a second time. Reading it back never writes it again.
 * @param source - a logged message's `source` value, of unknown provenance.
 * @returns whether this plugin already supplied the memory instructions.
 */
export function isMemorySource(source: unknown): boolean {
  if (typeof source !== 'object' || source === null) return false
  const record = source as { kind?: unknown; plugin?: unknown }
  if (record.kind === `plugin:${PLUGIN_ID}#${MEMORY_LOADER}`) return true
  return record.kind === 'plugin' && record.plugin === `${PLUGIN_ID}#${MEMORY_LOADER}`
}

/**
 * Render the memory instructions for one session's directory.
 * @param directory - absolute memory directory the model is told about.
 * @param index - the loaded index, or `undefined` when the directory has none.
 * @returns the instruction text folded into the request.
 */
export function renderMemoryInstructions(directory: string, index: MemoryIndex | undefined): string {
  const indexBody = index === undefined
    ? `_${MEMORY_INDEX_NAME} does not exist yet. Create it with the \`memory\` tool the first time you save a memory._`
    : index.content.trim() === ''
      ? `_${MEMORY_INDEX_NAME} exists but is empty._`
      : index.content.trimEnd()
  const truncated = index?.truncated === true
    ? `\n\n_The index above is truncated to the lines and bytes a session loads; read ${MEMORY_PATH_PREFIX}/${MEMORY_INDEX_NAME} for the rest._`
    : ''
  return `# Memory

You have a persistent memory directory at ${directory}. The \`memory\` tool addresses it as \`${MEMORY_PATH_PREFIX}\`. Its contents persist across conversations, so record durable facts here rather than anything that is only useful inside this conversation.

Each memory is one file holding one fact, with frontmatter:

\`\`\`markdown
---
name: <short-kebab-case-slug>
description: <one-line summary, used to decide relevance during recall>
metadata:
  type: user | feedback | project | reference
---

<the fact; for feedback/project, follow with **Why:** and **How to apply:** lines. Link related memories with [[their-name]].>
\`\`\`

Saving takes two steps.
**Step 1** — write the memory file with \`create\`, or update one with \`str_replace\` / \`insert\`.
**Step 2** — add a pointer to that file in \`${MEMORY_PATH_PREFIX}/${MEMORY_INDEX_NAME}\`. \`${MEMORY_INDEX_NAME}\` is an index, not a memory: each entry is one line under ~150 characters (\`- [Title](file.md) — one-line hook\`) and it carries no frontmatter. Never write memory content directly into \`${MEMORY_INDEX_NAME}\`.

Types: \`user\` (the user's role, goals, responsibilities, knowledge), \`feedback\` (guidance about how to approach work, recorded from corrections and from confirmations), \`project\` (ongoing work, goals, initiatives, bugs, incidents that are not derivable from the code or git history), \`reference\` (where to find things). Convert relative dates to absolute dates when saving, and do not save anything the repository already states.

## Memory index

${indexBody}${truncated}`
}

/**
 * Fold the memory instructions into an entering step's messages.
 * @param messages - the messages the step is about to send.
 * @param text - the rendered memory instructions.
 * @returns the messages with the instructions inserted after the last user message.
 */
export function foldMemoryInstructions(messages: UserMessage[], text: string): UserMessage[] {
  const message = createUserMessage({ content: [{ type: 'text', text }], source: memorySource() })
  const lastIndex = messages.findLastIndex(candidate => candidate.role === 'user')
  if (lastIndex < 0) return [...messages, message]
  return messages.toSpliced(lastIndex + 1, 0, message)
}

/**
 * Register the memory contributor for the lifetime of `ctx`.
 *
 * The instructions fold once per Session, into the first request that carries a
 * user message. A Session whose log already holds them — a resumed Session, or
 * one continued after the plugin was mounted — is left alone.
 * @param ctx - plugin context; the listener is disposed with it.
 * @param runtime - live settings and the session's memory directory.
 */
export function memoryInstructionListener(ctx: Context, runtime: MemoryRuntime): void {
  const inspected = new WeakSet<Session>()
  const folded = new WeakSet<Session>()

  ctx.on('agent/pre-step', async (
    { agent, signal },
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted) return decision
    if (!runtime.enabled()) return decision
    const session = agent.session
    if (session === undefined) return decision
    if (!inspected.has(session)) {
      inspected.add(session)
      if (hasMemoryInstructions(session)) folded.add(session)
    }
    if (folded.has(session) || decision.messages.length === 0) return decision
    const root = await runtime.directoryFor(session.header?.cwd)
    const store = new MemoryStore(root, { maxFileBytes: runtime.maxFileBytes() })
    const index = await store.readIndex(runtime.indexLines(), runtime.indexBytes())
    signal.throwIfAborted()
    folded.add(session)
    return { ...decision, messages: foldMemoryInstructions(decision.messages, renderMemoryInstructions(store.root, index)) }
  })
}

/** Whether one Session's log already carries this plugin's instructions. */
function hasMemoryInstructions(session: Session): boolean {
  return session.snapshotEvents().some(event =>
    event.type === 'user/message' && isMemorySource(event.data.source))
}
