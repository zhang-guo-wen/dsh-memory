/**
 * The `memory` tool: Claude's memory-tool command set over this session's
 * memory directory.
 *
 * The tool is deliberately flat — one `command` plus the fields that command
 * reads — because the memory tool's contract is a command set, not one
 * parameter object per verb, and the reply text is what tells the model what
 * happened. A path that escapes `/memories` is answered with the same refusal
 * string rather than thrown, so a confused call reads as guidance.
 *
 * @module @zhang-guo-wen/dsh-memory/tool
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolCallKind, ToolCallView } from '@deepseek-ai/dsh-tools'
import { MemoryPathError, MEMORY_PATH_PREFIX } from './paths.ts'
import type { MemoryRuntime } from './settings.ts'
import { MemoryStore, type ViewRange } from './store.ts'

/** Tool name this plugin registers. */
export const MEMORY_TOOL_NAME = 'memory'

/** Every command the tool accepts, matching Claude's memory tool. */
export const MEMORY_COMMANDS = ['view', 'create', 'str_replace', 'insert', 'delete', 'rename'] as const

/** One accepted command. */
export type MemoryCommand = (typeof MEMORY_COMMANDS)[number]

/** UI category per command, for the tool call's card. */
const CALL_KIND = {
  view: 'read',
  create: 'edit',
  str_replace: 'edit',
  insert: 'edit',
  delete: 'delete',
  rename: 'move',
} as const satisfies Record<MemoryCommand, ToolCallKind>

/** Model-facing tool description. */
const DESCRIPTION = `Read and write your persistent memory directory, addressed as ${MEMORY_PATH_PREFIX}.
It holds an index file ${MEMORY_PATH_PREFIX}/MEMORY.md plus one file per memory, and it survives across conversations.
Commands:
- view: list a directory up to 2 levels deep, or show a file with line numbers. Pass view_range [start, end] (1-based, -1 as the end means end of file) to read part of a file.
- create: write file_text to a new file. Fails when the file already exists.
- str_replace: replace old_str with new_str in a file. old_str must appear exactly once.
- insert: insert insert_text at the 0-based insert_line, in [0, line count].
- delete: remove a file, or a directory and its contents.
- rename: move old_path to new_path; the destination must not exist.
Save a memory in two steps: write its file, then add one pointer line to ${MEMORY_PATH_PREFIX}/MEMORY.md.`

/** One tool call's arguments, as the parameter schema infers them. */
interface MemoryArgs {
  command: string
  path?: string
  file_text?: string
  old_str?: string
  new_str?: string
  insert_line?: number
  insert_text?: string
  old_path?: string
  new_path?: string
  view_range?: readonly number[]
}

/** One canonical tool result. */
interface MemoryResult {
  command: string
  path: string
  message: string
}

/**
 * Register the `memory` tool.
 * @param ctx - plugin context.
 * @param runtime - live settings and the session's memory directory.
 * @returns the disposer withdrawing the registration; the caller owns its lifetime.
 */
export function registerMemoryTool(ctx: Context, runtime: MemoryRuntime): () => void {
  return ctx.tools.register(defineTool({
    name: MEMORY_TOOL_NAME,
    description: DESCRIPTION,
    parameters: {
      command: {
        type: 'string',
        required: true,
        enum: [...MEMORY_COMMANDS],
        description: 'The operation to perform.',
      },
      path: {
        type: 'string',
        description: `File or directory to operate on, addressed under ${MEMORY_PATH_PREFIX} (for example ${MEMORY_PATH_PREFIX}/MEMORY.md). Required for every command except rename.`,
      },
      file_text: {
        type: 'string',
        description: 'Full content of the file to create. Required for create.',
      },
      old_str: {
        type: 'string',
        description: 'Text to replace; it must appear exactly once in the file. Required for str_replace.',
      },
      new_str: {
        type: 'string',
        description: 'Replacement text for str_replace. Pass an empty string to delete old_str.',
      },
      insert_line: {
        type: 'integer',
        description: 'Insertion index, counted from 0 over the file\'s lines. Required for insert.',
      },
      insert_text: {
        type: 'string',
        description: 'Text to insert. Required for insert.',
      },
      old_path: {
        type: 'string',
        description: `Source path of the move, addressed under ${MEMORY_PATH_PREFIX}. Required for rename.`,
      },
      new_path: {
        type: 'string',
        description: `Destination path of the move, addressed under ${MEMORY_PATH_PREFIX}. Required for rename.`,
      },
      view_range: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Optional [start, end] line window for view, 1-based and inclusive; -1 as the end means end of file.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          command: { type: 'string', required: true },
          path: { type: 'string', required: true },
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    presentCall: (args): ToolCallView => {
      const subject = args.path ?? args.old_path ?? MEMORY_PATH_PREFIX
      return {
        card: 'generic',
        title: `Memory ${args.command}: ${subject}`,
        kind: CALL_KIND[args.command as MemoryCommand],
        rawInput: args.command === 'insert' ? args.insert_text : args.file_text ?? args.new_str,
      }
    },
    async execute(args, exec): Promise<MemoryResult> {
      const root = await runtime.directoryFor(exec.agent?.session?.header?.cwd)
      const store = new MemoryStore(root, { maxFileBytes: runtime.maxFileBytes() })
      const message = await runCommand(store, args)
      return { command: args.command, path: args.path ?? args.new_path ?? MEMORY_PATH_PREFIX, message }
    },
  }))
}

/**
 * Run one command and return the reply text the model reads.
 * @param store - the session's memory store.
 * @param args - the validated call arguments.
 * @returns the command's reply, in Claude's memory-tool wording.
 * @throws when the store fails outside the memory tool's own vocabulary.
 */
export async function runCommand(store: MemoryStore, args: MemoryArgs): Promise<string> {
  try {
    switch (args.command as MemoryCommand) {
      case 'view':
        return await store.view(required(args.path, 'path', args.command), viewRange(args.view_range))
      case 'create':
        return await store.create(required(args.path, 'path', args.command), args.file_text ?? '')
      case 'str_replace':
        return await store.strReplace(
          required(args.path, 'path', args.command),
          required(args.old_str, 'old_str', args.command),
          args.new_str ?? '',
        )
      case 'insert':
        return await store.insert(
          required(args.path, 'path', args.command),
          requiredNumber(args.insert_line, 'insert_line', args.command),
          args.insert_text ?? '',
        )
      case 'delete':
        return await store.delete(required(args.path, 'path', args.command))
      case 'rename':
        return await store.rename(
          required(args.old_path, 'old_path', args.command),
          required(args.new_path, 'new_path', args.command),
        )
      default:
        return `Error: unknown memory command ${JSON.stringify(args.command)}. Use one of: ${MEMORY_COMMANDS.join(', ')}.`
    }
  } catch (error: unknown) {
    // A refused path or a missing field is an answer, not a failure: the model
    // reads the memory tool's own wording and corrects the call.
    if (error instanceof MemoryPathError || error instanceof ArgumentError) return error.message
    throw error
  }
}

/** Reply text for a command missing one of its required fields. */
function missing(field: string, command: string): string {
  return `Error: \`${field}\` is required for the ${command} command.`
}

function required(value: string | undefined, field: string, command: string): string {
  if (value === undefined) throw new ArgumentError(missing(field, command))
  return value
}

function requiredNumber(value: number | undefined, field: string, command: string): number {
  if (value === undefined) throw new ArgumentError(missing(field, command))
  return value
}

/**
 * A command's own argument refusal: reported as the reply text rather than
 * thrown out of the tool, so it reads like every other memory reply.
 */
class ArgumentError extends Error {}

/** Normalize the optional view window into the store's tuple form. */
function viewRange(value: readonly number[] | undefined): ViewRange | undefined {
  const [start, end] = value ?? []
  if (start === undefined || end === undefined) return undefined
  return [start, end]
}
