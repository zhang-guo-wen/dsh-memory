import z from "@deepseek-ai/schemastery";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/paths.ts
/**
* Memory-directory resolution and the `/memories` path vocabulary.
*
* Claude's memory tool addresses every file through one virtual root,
* `/memories`, and refuses anything outside it. This plugin keeps that
* vocabulary while the user owns the real directory: the configured path (with
* `~` and an optional `{project}` token expanded) is what `/memories` means for
* a session. Every model-supplied path is resolved through
* {@link resolveMemoryPath}, which answers the requested text on refusal so the
* tool can report Claude's own error string.
*
* @module @guowenzhang/dsh-memory/paths
*/
/** Memory directory used when the user configures none: one subdirectory per project. */
const DEFAULT_MEMORY_DIRECTORY = "~/.dsh/memory/{project}";
/** Virtual root every model-facing memory path is addressed through. */
const MEMORY_PATH_PREFIX = "/memories";
/** Token in a configured directory replaced by the session project's directory name. */
const PROJECT_TOKEN = "{project}";
/** A model-supplied path that does not address a location inside the memory root. */
var MemoryPathError = class extends Error {
	/** The path exactly as the model supplied it. */
	requested;
	/**
	* @param requested - the model-supplied path text.
	*/
	constructor(requested) {
		super(`Path must start with ${MEMORY_PATH_PREFIX}, got: ${requested}`);
		this.name = "MemoryPathError";
		this.requested = requested;
	}
};
/**
* Expand a leading `~` against the process user home.
* @param configured - a configured directory, possibly starting with `~`.
* @returns the same path with `~` replaced by the user home.
*/
function expandHome(configured) {
	if (configured === "~") return homedir();
	if (configured.startsWith("~/") || configured.startsWith("~\\")) return join(homedir(), configured.slice(2));
	return configured;
}
/**
* Resolve the configured memory directory to an absolute path.
* @param configured - configured directory; blank uses {@link DEFAULT_MEMORY_DIRECTORY}.
* @param projectName - Claude-style project directory name substituted for {@link PROJECT_TOKEN}.
* @returns the absolute memory directory (which need not exist).
*/
function resolveMemoryDirectory(configured, projectName) {
	const trimmed = configured.trim();
	const expanded = expandHome(trimmed === "" ? DEFAULT_MEMORY_DIRECTORY : trimmed);
	return resolve(expanded.split(PROJECT_TOKEN).join(projectName));
}
/**
* Convert a model-facing path into an absolute host path inside the memory root.
*
* Accepted forms are `/memories`, `/memories/<relative>`, and the same relative
* text with or without that prefix; backslashes are accepted as separators. An
* absolute path outside the root, a `..` segment, or a drive-qualified path is
* refused.
* @param root - absolute memory directory.
* @param requested - the model-supplied path.
* @returns the absolute path inside `root`.
* @throws MemoryPathError when the path does not address a location inside `root`.
*/
function resolveMemoryPath(root, requested) {
	let relativeText = requested.trim().replace(/\\/g, "/");
	if (relativeText === "/memories" || relativeText === "memories") relativeText = "";
	else if (relativeText.startsWith(`/memories/`)) relativeText = relativeText.slice(10);
	else if (relativeText.startsWith("memories/")) relativeText = relativeText.slice(9);
	if (relativeText.startsWith("/") || /^[A-Za-z]:/.test(relativeText)) throw new MemoryPathError(requested);
	const segments = relativeText.split("/").filter((segment) => segment !== "" && segment !== ".");
	if (segments.some((segment) => segment === "..")) throw new MemoryPathError(requested);
	const absolute = resolve(root, ...segments);
	const inside = relative(root, absolute);
	if (inside.startsWith("..") || isAbsolute(inside)) throw new MemoryPathError(requested);
	return absolute;
}
/**
* Render an absolute path inside the memory root as the model-facing path.
* @param root - absolute memory directory.
* @param absolute - absolute path inside `root`.
* @returns the `/memories`-prefixed path with forward slashes.
*/
function memoryDisplayPath(root, absolute) {
	const inside = relative(root, absolute).replace(/\\/g, "/");
	return inside === "" ? MEMORY_PATH_PREFIX : `${MEMORY_PATH_PREFIX}/${inside}`;
}
/**
* Claude Code's project-directory name for a path: every character outside
* `[A-Za-z0-9]` becomes `-` (`C:\src\app` becomes `C--src-app`), which is how
* the directory under `<claude home>/projects` is named.
* @param path - the absolute project root path.
* @returns the directory name Claude Code uses.
*/
function projectSlug(path) {
	return path.replace(/[^A-Za-z0-9]/g, "-");
}
//#endregion
//#region src/store.ts
/**
* The memory store: Claude's memory-tool commands over a real directory.
*
* The directory holds what Claude's auto memory holds — an index file named
* `MEMORY.md` plus one topic file per memory — and the tool's commands keep
* Claude's addressing (`/memories/...`), its command set
* (`view`, `create`, `str_replace`, `insert`, `delete`, `rename`), and its
* reply strings, because a model trained against that tool reads the reply to
* decide what to do next. A refusal is therefore a returned reply, not a
* thrown error: the text is the contract.
*
* Every path is resolved through {@link resolveMemoryPath} and then checked
* against the real path of the root, so a symlink planted inside the directory
* cannot redirect a write outside it.
*
* @module @guowenzhang/dsh-memory/store
*/
/** The index file's name inside the memory directory. */
const MEMORY_INDEX_NAME = "MEMORY.md";
/** Lines of the index loaded into a session, matching Claude Code. */
const DEFAULT_INDEX_LINES = 200;
/** UTF-8 bytes of the index loaded into a session, matching Claude Code. */
const DEFAULT_INDEX_BYTES = 25600;
/** Lines a `view` of one file reports, matching the memory tool's ceiling. */
const MAX_VIEW_LINES = 999999;
/** Names never listed by a directory `view`, matching the memory tool. */
const HIDDEN_DIRECTORY_NAMES = /* @__PURE__ */ new Set(["node_modules"]);
/** Default {@link MemoryLimits}. */
const DEFAULT_MEMORY_LIMITS = { maxFileBytes: 1048576 };
/**
* One session's memory directory, addressed by Claude's memory-tool commands.
*/
var MemoryStore = class {
	/** Absolute memory directory. */
	root;
	limits;
	/**
	* @param root - absolute memory directory (created by the first write).
	* @param limits - byte caps applied to every file this store touches.
	*/
	constructor(root, limits = DEFAULT_MEMORY_LIMITS) {
		this.root = root;
		this.limits = limits;
	}
	/**
	* Read the index file whole, as the settings page shows it.
	* @returns the file's content, UTF-8 bytes, and line count, or `undefined` when there is no index file.
	*/
	async readIndexSource() {
		const path = join(this.root, MEMORY_INDEX_NAME);
		const info = await statOrUndefined$1(path);
		if (info === void 0 || !info.isFile()) return void 0;
		if (info.size > this.limits.maxFileBytes) return void 0;
		const content = await readFile(path, { encoding: "utf8" });
		return {
			content,
			bytes: Buffer.byteLength(content, "utf8"),
			lines: countLines(content)
		};
	}
	/**
	* Replace the index file's content, creating the directory when needed.
	* @param content - the index file's new content.
	* @returns the UTF-8 bytes and lines written.
	* @throws Error when the content outgrows the store's file cap.
	*/
	async writeIndex(content) {
		const bytes = Buffer.byteLength(content, "utf8");
		if (bytes > this.limits.maxFileBytes) throw new Error(`${memoryDisplayPath(this.root, join(this.root, MEMORY_INDEX_NAME))} is larger than this memory store's ${this.limits.maxFileBytes}-byte file limit`);
		await mkdir(this.root, { recursive: true });
		await writeFile(join(this.root, MEMORY_INDEX_NAME), content, { encoding: "utf8" });
		return {
			bytes,
			lines: countLines(content)
		};
	}
	/**
	* Read the index as a session loads it: the first `indexLines` lines or the
	* first `indexBytes` UTF-8 bytes, whichever ends first.
	* @param indexLines - line cap; defaults to {@link DEFAULT_INDEX_LINES}.
	* @param indexBytes - byte cap; defaults to {@link DEFAULT_INDEX_BYTES}.
	* @returns the loaded index, or `undefined` when the directory has no index file.
	*/
	async readIndex(indexLines = 200, indexBytes = DEFAULT_INDEX_BYTES) {
		const source = await this.readIndexSource();
		if (source === void 0) return void 0;
		const byLines = firstLines(truncateToBytes(source.content, indexBytes), indexLines);
		return {
			content: byLines,
			bytes: source.bytes,
			lines: source.lines,
			truncated: byLines.length !== source.content.length
		};
	}
	/**
	* List every file in the memory directory, for the settings page.
	* @param maxDepth - how many directory levels below the root to walk.
	* @returns the files in name order, with their sizes and modification times.
	*/
	async listFiles(maxDepth = 3) {
		const rows = [];
		await this.walk(this.root, maxDepth, rows);
		return rows.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
	}
	/**
	* Answer a `view` command for one file or directory.
	* @param requested - the model-supplied path under `/memories`.
	* @param viewRange - optional 1-based inclusive line window for a file; `-1` as the end means end of file.
	* @returns the listing or line-numbered content, or the reply text for a missing path.
	* @throws MemoryPathError when the path addresses a location outside the memory root.
	*/
	async view(requested, viewRange) {
		const target = await this.resolveChecked(requested);
		const info = await statOrUndefined$1(target.absolute);
		if (info === void 0) return missingPath(target.display);
		if (info.isDirectory()) return await this.renderDirectory(target.display, target.absolute);
		if (!info.isFile()) return missingPath(target.display);
		if (info.size > this.limits.maxFileBytes) return oversized(target.display, this.limits.maxFileBytes);
		const text = await readFile(target.absolute, { encoding: "utf8" });
		return renderFileView(target.display, text, viewRange);
	}
	/**
	* Answer a `create` command: write a new file, refusing an existing one.
	* @param requested - the model-supplied path under `/memories`.
	* @param fileText - the file's full content.
	* @returns the reply text.
	* @throws MemoryPathError when the path addresses a location outside the memory root.
	*/
	async create(requested, fileText) {
		const target = await this.resolveChecked(requested);
		if (await statOrUndefined$1(target.absolute) !== void 0) return alreadyExists(target.display);
		if (Buffer.byteLength(fileText, "utf8") > this.limits.maxFileBytes) return oversized(target.display, this.limits.maxFileBytes);
		await mkdir(dirname(target.absolute), { recursive: true });
		try {
			await writeFile(target.absolute, fileText, {
				encoding: "utf8",
				flag: "wx"
			});
		} catch (error) {
			if (isErrnoCode(error, "EEXIST")) return alreadyExists(target.display);
			throw error;
		}
		return `File created successfully at: ${target.display}`;
	}
	/**
	* Answer a `str_replace` command: replace one uniquely occurring string.
	* @param requested - the model-supplied path under `/memories`.
	* @param oldStr - text that must occur exactly once.
	* @param newStr - replacement text; an empty string deletes `oldStr`.
	* @returns the reply text, including a line-numbered window around the edit.
	* @throws MemoryPathError when the path addresses a location outside the memory root.
	*/
	async strReplace(requested, oldStr, newStr) {
		const target = await this.resolveChecked(requested);
		const read = await this.readEditable(target.absolute, target.display);
		if ("reply" in read) return read.reply;
		const current = read.content;
		const occurrences = countOccurrences(current, oldStr);
		if (occurrences === 0) return `No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${target.display}.`;
		if (occurrences > 1) return `No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: ${occurrenceLines(current, oldStr).join(", ")}. Please ensure it is unique`;
		const index = current.indexOf(oldStr);
		const updated = `${current.slice(0, index)}${newStr}${current.slice(index + oldStr.length)}`;
		await this.write(target.absolute, updated, target.display);
		const changedLine = countLines(current.slice(0, index)) + 1;
		return `The memory file has been edited.\n${renderWindow(target.display, updated, changedLine - 3, newStr)}`;
	}
	/**
	* Answer an `insert` command: insert text at a 0-based line index.
	* @param requested - the model-supplied path under `/memories`.
	* @param insertLine - 0-based insertion index in `[0, line count]`.
	* @param insertText - text to insert.
	* @returns the reply text.
	* @throws MemoryPathError when the path addresses a location outside the memory root.
	*/
	async insert(requested, insertLine, insertText) {
		const target = await this.resolveChecked(requested);
		const read = await this.readEditable(target.absolute, target.display);
		if ("reply" in read) return read.reply;
		const lines = splitLines(read.content);
		if (!Number.isInteger(insertLine) || insertLine < 0 || insertLine > lines.length) return `Error: Invalid \`insert_line\` parameter: ${insertLine}. It should be within the range of lines of the file: [0, ${lines.length}]`;
		const inserted = insertText.split("\n");
		if (inserted[inserted.length - 1] === "") inserted.pop();
		const updated = [
			...lines.slice(0, insertLine),
			...inserted,
			...lines.slice(insertLine)
		].join("\n");
		await this.write(target.absolute, updated, target.display);
		return `The file ${target.display} has been edited.`;
	}
	/**
	* Answer a `delete` command: remove a file or a directory tree.
	* @param requested - the model-supplied path under `/memories`.
	* @returns the reply text.
	* @throws MemoryPathError when the path addresses a location outside the memory root.
	*/
	async delete(requested) {
		const target = await this.resolveChecked(requested);
		if (target.absolute === this.root) return `Cannot delete the ${memoryDisplayPath(this.root, this.root)} directory itself`;
		if (await statOrUndefined$1(target.absolute) === void 0) return missingPath(target.display);
		await rm(target.absolute, {
			recursive: true,
			force: true
		});
		return `Successfully deleted ${target.display}`;
	}
	/**
	* Answer a `rename` command: move a file or directory, refusing to overwrite.
	* @param requested - the model-supplied source path under `/memories`.
	* @param destination - the model-supplied destination path under `/memories`.
	* @returns the reply text.
	* @throws MemoryPathError when either path addresses a location outside the memory root.
	*/
	async rename(requested, destination) {
		const source = await this.resolveChecked(requested);
		const target = await this.resolveChecked(destination);
		if (await statOrUndefined$1(source.absolute) === void 0) return `Error: The path ${source.display} does not exist`;
		if (await statOrUndefined$1(target.absolute) !== void 0) return `Error: The destination ${target.display} already exists`;
		await mkdir(dirname(target.absolute), { recursive: true });
		await rename(source.absolute, target.absolute);
		return `Successfully renamed ${source.display} to ${target.display}`;
	}
	/** Resolve one model path and refuse one that escapes the root's real path. */
	async resolveChecked(requested) {
		const absolute = resolveMemoryPath(this.root, requested);
		const display = memoryDisplayPath(this.root, absolute);
		const rootReal = await realpathOrUndefined(this.root);
		if (rootReal === void 0) return {
			absolute,
			display
		};
		const existingReal = await realpathOrUndefined(await nearestExisting(absolute, this.root));
		if (existingReal === void 0) return {
			absolute,
			display
		};
		const inside = relative(rootReal, existingReal);
		if (inside.startsWith("..") || isAbsolute(inside)) throw new MemoryPathError(display);
		return {
			absolute,
			display
		};
	}
	/** Read a file the model intends to edit, or the reply text explaining why not. */
	async readEditable(absolute, display) {
		const info = await statOrUndefined$1(absolute);
		if (info === void 0 || !info.isFile()) return { reply: missingPath(display) };
		if (info.size > this.limits.maxFileBytes) return { reply: oversized(display, this.limits.maxFileBytes) };
		return { content: await readFile(absolute, { encoding: "utf8" }) };
	}
	/** Write one edited file, refusing content that outgrows the store's cap. */
	async write(absolute, text, display) {
		if (Buffer.byteLength(text, "utf8") > this.limits.maxFileBytes) throw new Error(oversized(display, this.limits.maxFileBytes));
		await writeFile(absolute, text, { encoding: "utf8" });
	}
	/** Render one directory level (and its children) as the `view` listing. */
	async renderDirectory(display, absolute) {
		const rows = [];
		await this.collect(absolute, display, 2, rows);
		const header = `Here're the files and directories up to 2 levels deep in ${display}, excluding hidden items:`;
		if (rows.length === 0) return `${header}\n(empty)`;
		return `${header}\n${rows.map((row) => `${formatSize(row.bytes)}\t${row.display}`).join("\n")}`;
	}
	/** Collect one directory level and, while depth remains, its children. */
	async collect(absolute, display, depth, rows) {
		if (depth <= 0) return;
		for (const entry of await readdirOrEmpty(absolute)) {
			if (entry.name.startsWith(".") || HIDDEN_DIRECTORY_NAMES.has(entry.name)) continue;
			const child = join(absolute, entry.name);
			const childDisplay = `${display === "/" ? "" : display}/${entry.name}`;
			const info = await statOrUndefined$1(child);
			if (info === void 0) continue;
			rows.push({
				display: childDisplay,
				bytes: info.isDirectory() ? await sumBytes(child, depth - 1) : info.size
			});
			if (info.isDirectory()) await this.collect(child, childDisplay, depth - 1, rows);
		}
	}
	/** Walk the memory directory for the settings page's file list. */
	async walk(absolute, depth, rows) {
		if (depth < 0) return;
		for (const entry of await readdirOrEmpty(absolute)) {
			if (entry.name.startsWith(".")) continue;
			const child = join(absolute, entry.name);
			const info = await statOrUndefined$1(child);
			if (info === void 0) continue;
			if (info.isDirectory()) {
				await this.walk(child, depth - 1, rows);
				continue;
			}
			if (!info.isFile()) continue;
			rows.push({
				path: memoryDisplayPath(this.root, child),
				bytes: info.size,
				modifiedMs: info.mtimeMs
			});
		}
	}
};
/** Reply text for a path that names nothing. */
function missingPath(display) {
	return `Error: The path ${display} does not exist. Please provide a valid path.`;
}
/** Reply text for a file that outgrows the store's cap. */
function oversized(display, maxFileBytes) {
	return `Error: ${display} is larger than this memory store's ${maxFileBytes}-byte file limit.`;
}
/** Reply text for a `create` over an existing entry. */
function alreadyExists(display) {
	return `Error: File ${display} already exists`;
}
/** Render a file as Claude's line-numbered `view` content. */
function renderFileView(display, text, viewRange) {
	const lines = splitLines(text);
	if (lines.length > 999999) return `File ${display} exceeds maximum line limit of ${MAX_VIEW_LINES.toLocaleString("en-US")} lines.`;
	const [first, last] = viewRange === void 0 ? [1, lines.length] : [viewRange[0], viewRange[1] === -1 ? lines.length : viewRange[1]];
	if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || first > lines.length) return `Error: Invalid \`view_range\` parameter: [${viewRange?.[0]}, ${viewRange?.[1]}]. It should be within the range of lines of the file: [1, ${lines.length}]`;
	return `Here's the content of ${display} with line numbers:\n${numberLines(lines.slice(first - 1, Math.min(last, lines.length)), first)}`;
}
/** Render a line-numbered window around one edit, clamped to the file. */
function renderWindow(display, text, from, inserted) {
	const lines = splitLines(text);
	const first = Math.max(1, from);
	const last = Math.min(lines.length, first + 6 + inserted.split("\n").length);
	return `${numberLines(lines.slice(first - 1, last), first)}`;
}
/** Number lines the way the memory tool does: six columns, right-aligned, tab-separated. */
function numberLines(lines, firstNumber) {
	return lines.map((line, offset) => `${String(firstNumber + offset).padStart(6, " ")}\t${line}`).join("\n");
}
/** Split text into lines the way an insertion index counts them. */
function splitLines(text) {
	if (text === "") return [];
	const lines = text.split("\n");
	if (lines[lines.length - 1] === "") lines.pop();
	return lines;
}
/** Count the lines a text occupies, matching {@link splitLines}. */
function countLines(text) {
	return splitLines(text).length;
}
/** Cut a text to its first `limit` lines. */
function firstLines(text, limit) {
	if (limit <= 0) return "";
	const lines = text.split("\n");
	if (lines.length <= limit) return text;
	return lines.slice(0, limit).join("\n");
}
/** Cut a text to at most `limit` UTF-8 bytes without splitting a character. */
function truncateToBytes(text, limit) {
	const encoded = Buffer.from(text, "utf8");
	if (encoded.length <= limit) return text;
	return new TextDecoder("utf-8", { fatal: false }).decode(encoded.subarray(0, limit)).replace(/\uFFFD$/u, "");
}
/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack, needle) {
	if (needle === "") return 0;
	let count = 0;
	let index = haystack.indexOf(needle);
	while (index !== -1) {
		count += 1;
		index = haystack.indexOf(needle, index + needle.length);
	}
	return count;
}
/** The 1-based line numbers where `needle` occurs. */
function occurrenceLines(haystack, needle) {
	const lines = [];
	let index = haystack.indexOf(needle);
	while (index !== -1) {
		lines.push(countLines(haystack.slice(0, index)) + 1);
		index = haystack.indexOf(needle, index + needle.length);
	}
	return lines;
}
/** Human-readable byte size, as a directory listing shows it. */
function formatSize(bytes) {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`;
	return `${(bytes / 1048576).toFixed(1)}M`;
}
/** Recursive byte total of one directory, bounded by `depth`. */
async function sumBytes(absolute, depth) {
	if (depth < 0) return 0;
	let total = 0;
	for (const entry of await readdirOrEmpty(absolute)) {
		if (entry.name.startsWith(".") || HIDDEN_DIRECTORY_NAMES.has(entry.name)) continue;
		const child = join(absolute, entry.name);
		const info = await statOrUndefined$1(child);
		if (info === void 0) continue;
		total += info.isDirectory() ? await sumBytes(child, depth - 1) : info.size;
	}
	return total;
}
/** The nearest existing path at or below `stop`, starting from `target`. */
async function nearestExisting(target, stop) {
	let current = target;
	for (;;) {
		if (await statOrUndefined$1(current) !== void 0) return current;
		if (current === stop) return stop;
		const parent = dirname(current);
		if (parent === current) return stop;
		current = parent;
	}
}
async function statOrUndefined$1(path) {
	try {
		return await stat(path);
	} catch {
		return;
	}
}
async function realpathOrUndefined(path) {
	try {
		return await realpath(path);
	} catch {
		return;
	}
}
async function readdirOrEmpty(path) {
	try {
		return await readdir(path, { withFileTypes: true });
	} catch {
		return [];
	}
}
function isErrnoCode(error, code) {
	return typeof error === "object" && error !== null && error.code === code;
}
//#endregion
//#region src/instructions.ts
/** Package identity recorded on every injected message this plugin produces. */
const PLUGIN_ID = "@guowenzhang/dsh-memory";
/** Loader name this plugin's one contributor records. */
const MEMORY_LOADER = "memory-index";
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
function memorySource() {
	return {
		kind: `plugin:${PLUGIN_ID}#${MEMORY_LOADER}`,
		form: "instructions"
	};
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
function isMemorySource(source) {
	if (typeof source !== "object" || source === null) return false;
	const record = source;
	if (record.kind === `plugin:@guowenzhang/dsh-memory#memory-index`) return true;
	return record.kind === "plugin" && record.plugin === `@guowenzhang/dsh-memory#memory-index`;
}
/**
* Render the memory instructions for one session's directory.
* @param directory - absolute memory directory the model is told about.
* @param index - the loaded index, or `undefined` when the directory has none.
* @returns the instruction text folded into the request.
*/
function renderMemoryInstructions(directory, index) {
	const indexBody = index === void 0 ? `_${MEMORY_INDEX_NAME} does not exist yet. Create it with the \`memory\` tool the first time you save a memory._` : index.content.trim() === "" ? `_${MEMORY_INDEX_NAME} exists but is empty._` : index.content.trimEnd();
	const truncated = index?.truncated === true ? `\n\n_The index above is truncated to the lines and bytes a session loads; read ${MEMORY_PATH_PREFIX}/${MEMORY_INDEX_NAME} for the rest._` : "";
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

${indexBody}${truncated}`;
}
/**
* Fold the memory instructions into an entering step's messages.
* @param messages - the messages the step is about to send.
* @param text - the rendered memory instructions.
* @returns the messages with the instructions inserted after the last user message.
*/
function foldMemoryInstructions(messages, text) {
	const message = createUserMessage({
		content: [{
			type: "text",
			text
		}],
		source: memorySource()
	});
	const lastIndex = messages.findLastIndex((candidate) => candidate.role === "user");
	if (lastIndex < 0) return [...messages, message];
	return messages.toSpliced(lastIndex + 1, 0, message);
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
function memoryInstructionListener(ctx, runtime) {
	const inspected = /* @__PURE__ */ new WeakSet();
	const folded = /* @__PURE__ */ new WeakSet();
	ctx.on("agent/pre-step", async ({ agent, signal }, next) => {
		const decision = await next();
		if (decision.kind === "reject" || signal.aborted) return decision;
		if (!runtime.enabled()) return decision;
		const session = agent.session;
		if (session === void 0) return decision;
		if (!inspected.has(session)) {
			inspected.add(session);
			if (hasMemoryInstructions(session)) folded.add(session);
		}
		if (folded.has(session) || decision.messages.length === 0) return decision;
		const store = new MemoryStore(await runtime.directoryFor(session.header?.cwd), { maxFileBytes: runtime.maxFileBytes() });
		const index = await store.readIndex(runtime.indexLines(), runtime.indexBytes());
		signal.throwIfAborted();
		folded.add(session);
		return {
			...decision,
			messages: foldMemoryInstructions(decision.messages, renderMemoryInstructions(store.root, index))
		};
	});
}
/** Whether one Session's log already carries this plugin's instructions. */
function hasMemoryInstructions(session) {
	return session.snapshotEvents().some((event) => event.type === "user/message" && isMemorySource(event.data.source));
}
//#endregion
//#region src/targets.ts
/**
* The projects the settings page can look at.
*
* A memory directory is resolved per project, so one page cannot show them all
* at once. This module answers with the stores a deployment knows about — the
* host process's own project, every DSH workspace, and (in Claude-directory
* mode) every project directory Claude Code keeps — and resolves a selection
* back to the directory it names.
*
* Workspaces come from `ctx.workspaceRegistry` when it is mounted; a
* composition without it still lists the current project and, in Claude mode,
* Claude's own project directories.
*
* @module @guowenzhang/dsh-memory/targets
*/
/** Selection id of the host process's own project. */
const CURRENT_TARGET_ID = "current";
/** Prefix of a DSH workspace selection id. */
const WORKSPACE_TARGET_PREFIX = "workspace:";
/** Prefix of a Claude project selection id. */
const CLAUDE_TARGET_PREFIX = "claude:";
/** The workspace registry, when the composition mounts one. */
function workspaces(ctx) {
	const registry = ctx.get("workspaceRegistry");
	try {
		return registry?.list() ?? [];
	} catch {
		return [];
	}
}
/**
* List the memory stores this deployment can show, nearest first.
*
* Rows are deduplicated by their resolved directory, so a workspace and the
* Claude project it maps to appear once.
* @param ctx - host context (uses `ctx.workspaceRegistry` when present).
* @param runtime - live settings and directory resolution.
* @returns the current project, every workspace, and Claude's project directories.
*/
async function listMemoryTargets(ctx, runtime) {
	const rows = [];
	const seen = /* @__PURE__ */ new Set();
	const push = async (id, label, detail, directory) => {
		const key = normalize(directory).toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		rows.push({
			id,
			label,
			detail,
			directory,
			exists: await existsAt$1(directory)
		});
	};
	const current = resolve(process.cwd());
	await push(CURRENT_TARGET_ID, basename(current) || current, current, await runtime.directoryFor(current));
	for (const workspace of workspaces(ctx)) await push(`${WORKSPACE_TARGET_PREFIX}${workspace.id}`, workspace.title, workspace.path, await runtime.directoryFor(workspace.path));
	if (runtime.claudeCompatible()) for (const slug of await claudeProjectSlugs(runtime)) await push(`${CLAUDE_TARGET_PREFIX}${slug}`, slug, join(runtime.claudeProjectsRoot(), slug), runtime.claudeProjectDirectory(slug));
	return rows;
}
/**
* Resolve one selection back to the memory directory it names.
*
* An unknown or absent id — a stale selection, or a composition without a
* workspace registry — falls back to the host process's own project rather than
* failing the request.
* @param ctx - host context (uses `ctx.workspaceRegistry` when present).
* @param runtime - live settings and directory resolution.
* @param target - selection id from {@link listMemoryTargets}.
* @returns the selection id that was used and its absolute memory directory.
*/
async function resolveMemoryTarget(ctx, runtime, target) {
	if (target !== void 0 && target.startsWith("workspace:")) {
		const id = target.slice(10);
		const workspace = workspaces(ctx).find((candidate) => candidate.id === id);
		if (workspace !== void 0) return {
			id: target,
			directory: await runtime.directoryFor(workspace.path)
		};
	}
	if (target !== void 0 && target.startsWith("claude:")) return {
		id: target,
		directory: runtime.claudeProjectDirectory(target.slice(7))
	};
	return {
		id: CURRENT_TARGET_ID,
		directory: await runtime.directoryFor(void 0)
	};
}
/** The project directories Claude Code keeps under its home. */
async function claudeProjectSlugs(runtime) {
	try {
		return (await readdir(runtime.claudeProjectsRoot(), { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name).sort();
	} catch {
		return [];
	}
}
/** Whether a path exists at all. */
async function existsAt$1(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}
//#endregion
//#region src/remote.ts
/**
* Host owner of the `memoryStore` Remote namespace: what the settings page
* reads (the directory's state, the index's content) and the one thing it
* writes (the index).
*
* The service is registered unconditionally: a guarded registration would make
* every client call fail with a missing namespace instead of a reportable
* error.
*
* @module @guowenzhang/dsh-memory/remote
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/**
* Host service behind the `memoryStore` Remote namespace. Every method answers
* for one selected project — the Host process's own by default, or whichever
* the settings page picked from `targets` — because the settings page is not
* session-scoped and a `{project}` template resolves per project.
*/
let MemoryRemote = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _targets_decorators;
	let _status_decorators;
	let _readIndex_decorators;
	let _writeIndex_decorators;
	return class MemoryRemote extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_targets_decorators = [Remote("targets")];
			_status_decorators = [Remote("status")];
			_readIndex_decorators = [Remote("readIndex")];
			_writeIndex_decorators = [Remote("writeIndex")];
			__esDecorate(this, null, _targets_decorators, {
				kind: "method",
				name: "targets",
				static: false,
				private: false,
				access: {
					has: (obj) => "targets" in obj,
					get: (obj) => obj.targets
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _status_decorators, {
				kind: "method",
				name: "status",
				static: false,
				private: false,
				access: {
					has: (obj) => "status" in obj,
					get: (obj) => obj.status
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _readIndex_decorators, {
				kind: "method",
				name: "readIndex",
				static: false,
				private: false,
				access: {
					has: (obj) => "readIndex" in obj,
					get: (obj) => obj.readIndex
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _writeIndex_decorators, {
				kind: "method",
				name: "writeIndex",
				static: false,
				private: false,
				access: {
					has: (obj) => "writeIndex" in obj,
					get: (obj) => obj.writeIndex
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		runtime = __runInitializers(this, _instanceExtraInitializers);
		/**
		* @param ctx - host context.
		* @param runtime - live settings and directory resolution.
		*/
		constructor(ctx, runtime) {
			super(ctx, "memoryStore");
			this.runtime = runtime;
		}
		/**
		* List the projects the settings page can look at.
		* @param request - empty placeholder; the list is host-wide. The parameter
		*   must keep this name: the gateway derives its descriptor from the method
		*   signature and rejects a payload whose field does not match.
		* @returns the current project, every workspace, and Claude's project directories.
		*/
		async targets(request) {
			return { targets: await listMemoryTargets(this.ctx, this.runtime) };
		}
		/**
		* Report one project's memory directory state.
		* @param request - the selected project, absent for the host process's own.
		* @returns the configured and resolved directory, the index's state, and every file.
		*/
		async status(request) {
			const configured = this.runtime.configuredDirectory();
			const { id, directory } = await resolveMemoryTarget(this.ctx, this.runtime, request.target);
			const store = new MemoryStore(directory, { maxFileBytes: this.runtime.maxFileBytes() });
			const [indexSource, files, exists] = await Promise.all([
				store.readIndexSource(),
				store.listFiles(),
				existsAt(store.root)
			]);
			return {
				enabled: this.runtime.enabled(),
				claudeCompatible: this.runtime.claudeCompatible(),
				target: id,
				configured,
				directory: store.root,
				projectScoped: configured.includes(PROJECT_TOKEN),
				exists,
				index: indexSource === void 0 ? null : indexView(indexSource, this.runtime),
				files,
				totalBytes: files.reduce((total, file) => total + file.bytes, 0),
				maxFileBytes: this.runtime.maxFileBytes()
			};
		}
		/**
		* Read one project's index file for the settings editor.
		* @param request - the selected project, absent for the host process's own.
		* @returns whether the index exists, its content, and its size.
		* @throws a typed memory error when the file cannot be read.
		*/
		async readIndex(request) {
			const store = await this.store(request.target);
			try {
				const source = await store.readIndexSource();
				return source === void 0 ? {
					exists: false,
					content: "",
					bytes: 0
				} : {
					exists: true,
					content: source.content,
					bytes: source.bytes
				};
			} catch (cause) {
				throw ioFailure(`reading ${MEMORY_PATH_PREFIX}/${MEMORY_INDEX_NAME} failed`, cause);
			}
		}
		/**
		* Replace one project's index file content.
		* @param request - the selected project and the index file's new content.
		* @returns the bytes and lines written.
		* @throws a typed memory error when the content is not text or cannot be written.
		*/
		async writeIndex(request) {
			if (typeof request.content !== "string") throw new RemoteError("memory/invalid", "writeIndex requires a string `content`", { reason: `content was ${typeof request.content}` });
			const store = await this.store(request.target);
			try {
				return await store.writeIndex(request.content);
			} catch (cause) {
				throw ioFailure(`writing ${MEMORY_PATH_PREFIX}/${MEMORY_INDEX_NAME} failed`, cause);
			}
		}
		/** The store one selection names, falling back to the Host process's own project. */
		async store(target) {
			const { directory } = await resolveMemoryTarget(this.ctx, this.runtime, target);
			return new MemoryStore(directory, { maxFileBytes: this.runtime.maxFileBytes() });
		}
	};
})();
/** The index view one status report carries. */
function indexView(source, runtime) {
	const limitLines = runtime.indexLines();
	const limitBytes = runtime.indexBytes();
	return {
		path: `${MEMORY_PATH_PREFIX}/${MEMORY_INDEX_NAME}`,
		bytes: source.bytes,
		lines: source.lines,
		limitLines,
		limitBytes,
		truncated: source.lines > limitLines || source.bytes > limitBytes
	};
}
/** Whether a path exists at all. */
async function existsAt(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}
/** Classify a settings-page store failure for the Remote caller. */
function ioFailure(message, cause) {
	return new RemoteError("memory/io", message, { reason: reasonOf(cause) }, { cause });
}
function reasonOf(cause) {
	return cause instanceof Error ? cause.message : String(cause);
}
//#endregion
//#region src/settings.ts
/**
* Memory settings: the user's memory directory and the on/off switch.
*
* One namespace (`memory`) owns both fields, so the settings page and the Host
* behavior share one value. Values resolve through `ctx.settings` when the
* settings service is mounted and fall back to the composition `base`
* otherwise; the settings service is read through a small local interface so
* this package stays composable in trees that do not mount it.
*
* @module @guowenzhang/dsh-memory/settings
*/
/** Settings namespace owned by this plugin. */
const MEMORY_SETTINGS_NAMESPACE = "memory";
/** Schema served to settings clients for this namespace. */
const MEMORY_SETTINGS_SCHEMA = z.object({
	enabled: z.boolean().default(true),
	directory: z.string().default(DEFAULT_MEMORY_DIRECTORY),
	claudeCompatible: z.boolean().default(false)
});
/**
* Register the `memory` namespace and return the runtime the tool and the
* contributor read.
*
* Without a mounted settings service the runtime stays pinned to the
* composition defaults. A namespace already owned by another plugin keeps that
* owner's value — this plugin never throws.
* @param ctx - plugin context (uses `ctx.get('settings')`-equivalent injection when present).
* @param config - composition defaults and caps.
* @param onCommitted - observer invoked after each committed change, so a live
*   registration can follow the switch.
* @returns the live runtime.
*/
function registerMemorySettings(ctx, config = {}, onCommitted) {
	const base = {
		enabled: config.enabled ?? true,
		directory: config.directory ?? "~/.dsh/memory/{project}",
		claudeCompatible: config.claudeCompatible ?? false
	};
	let flags = () => ({ ...base });
	ctx.inject(["settings"], (settingsCtx) => {
		const provider = settingsCtx.settings;
		try {
			const scope = provider.register(MEMORY_SETTINGS_NAMESPACE, MEMORY_SETTINGS_SCHEMA, {
				base,
				applies: "live"
			});
			flags = () => ({ ...scope.get() });
			scope.watch((next) => {
				flags = () => ({ ...next });
				onCommitted?.({ ...next });
			});
		} catch {}
	});
	const markers = config.projectRootMarkers ?? [".git"];
	const claudeHome = resolveClaudeHome(config);
	const names = /* @__PURE__ */ new Map();
	const projectNameFor = async (cwd) => {
		const start = resolve(cwd ?? process.cwd());
		const cached = names.get(start);
		if (cached !== void 0) return await cached;
		const pending = resolveProjectName(start, markers);
		names.set(start, pending);
		return await pending;
	};
	return {
		enabled: () => flags().enabled,
		claudeCompatible: () => flags().claudeCompatible,
		configuredDirectory: () => flags().directory,
		directoryFor: async (cwd) => {
			const project = await projectNameFor(cwd);
			if (flags().claudeCompatible) return join(claudeHome, "projects", project, "memory");
			return resolveMemoryDirectory(flags().directory, project);
		},
		indexLines: () => config.indexLines ?? 200,
		indexBytes: () => config.indexBytes ?? 25600,
		maxFileBytes: () => config.maxFileBytes ?? DEFAULT_MEMORY_LIMITS.maxFileBytes,
		claudeProjectsRoot: () => join(claudeHome, "projects"),
		claudeProjectDirectory: (slug) => join(claudeHome, "projects", slug, "memory")
	};
}
/**
* Resolve the Claude Code config directory.
*
* Claude Code itself reads `$CLAUDE_CONFIG_DIR`; `$CLAUDE_HOME` is the older
* variable the sibling compatibility plugin already honored, and `~/.claude` is
* the default.
* @param config - composition configuration carrying an optional explicit home.
* @returns the absolute Claude home path.
*/
function resolveClaudeHome(config) {
	return resolve(config.claudeHome ?? process.env.CLAUDE_CONFIG_DIR ?? process.env.CLAUDE_HOME ?? join(homedir(), ".claude"));
}
/** The Claude-style project directory name for one session working directory. */
async function resolveProjectName(cwd, markers) {
	return projectSlug(await repositoryRoot(await findProjectRoot(cwd, markers)));
}
/** Walk upward to the nearest ancestor holding a project-root marker. */
async function findProjectRoot(cwd, markers) {
	let current = cwd;
	for (;;) {
		for (const marker of markers) if (await exists(join(current, marker))) return current;
		const parent = dirname(current);
		if (parent === current) return cwd;
		current = parent;
	}
}
/**
* The repository a project root belongs to.
*
* A `.git` file means a linked worktree: it points at
* `<main>/.git/worktrees/<name>`, so the main repository is recovered from that
* path and every worktree of one repository shares a memory directory, as it
* does in Claude Code.
*/
async function repositoryRoot(projectRoot) {
	const marker = join(projectRoot, ".git");
	const info = await statOrUndefined(marker);
	if (info === void 0 || info.isDirectory()) return projectRoot;
	const text = await readFileOrUndefined(marker);
	const target = /^gitdir:\s*(.+)$/m.exec(text ?? "")?.[1]?.trim();
	if (target === void 0) return projectRoot;
	const match = /^(.*)[\\/]worktrees[\\/][^\\/]+$/u.exec(target);
	if (match?.[1] === void 0) return projectRoot;
	return dirname(match[1]);
}
async function exists(path) {
	return await statOrUndefined(path) !== void 0;
}
async function statOrUndefined(path) {
	try {
		return await stat(path);
	} catch {
		return;
	}
}
async function readFileOrUndefined(path) {
	try {
		return await readFile(path, { encoding: "utf8" });
	} catch {
		return;
	}
}
//#endregion
//#region src/tool.ts
/** Tool name this plugin registers. */
const MEMORY_TOOL_NAME = "memory";
/** Every command the tool accepts, matching Claude's memory tool. */
const MEMORY_COMMANDS = [
	"view",
	"create",
	"str_replace",
	"insert",
	"delete",
	"rename"
];
/** UI category per command, for the tool call's card. */
const CALL_KIND = {
	view: "read",
	create: "edit",
	str_replace: "edit",
	insert: "edit",
	delete: "delete",
	rename: "move"
};
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
Save a memory in two steps: write its file, then add one pointer line to ${MEMORY_PATH_PREFIX}/MEMORY.md.`;
/**
* Register the `memory` tool.
* @param ctx - plugin context.
* @param runtime - live settings and the session's memory directory.
* @returns the disposer withdrawing the registration; the caller owns its lifetime.
*/
function registerMemoryTool(ctx, runtime) {
	return ctx.tools.register(defineTool({
		name: MEMORY_TOOL_NAME,
		description: DESCRIPTION,
		parameters: {
			command: {
				type: "string",
				required: true,
				enum: [...MEMORY_COMMANDS],
				description: "The operation to perform."
			},
			path: {
				type: "string",
				description: `File or directory to operate on, addressed under ${MEMORY_PATH_PREFIX} (for example ${MEMORY_PATH_PREFIX}/MEMORY.md). Required for every command except rename.`
			},
			file_text: {
				type: "string",
				description: "Full content of the file to create. Required for create."
			},
			old_str: {
				type: "string",
				description: "Text to replace; it must appear exactly once in the file. Required for str_replace."
			},
			new_str: {
				type: "string",
				description: "Replacement text for str_replace. Pass an empty string to delete old_str."
			},
			insert_line: {
				type: "integer",
				description: "Insertion index, counted from 0 over the file's lines. Required for insert."
			},
			insert_text: {
				type: "string",
				description: "Text to insert. Required for insert."
			},
			old_path: {
				type: "string",
				description: `Source path of the move, addressed under ${MEMORY_PATH_PREFIX}. Required for rename.`
			},
			new_path: {
				type: "string",
				description: `Destination path of the move, addressed under ${MEMORY_PATH_PREFIX}. Required for rename.`
			},
			view_range: {
				type: "array",
				items: { type: "integer" },
				description: "Optional [start, end] line window for view, 1-based and inclusive; -1 as the end means end of file."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					command: {
						type: "string",
						required: true
					},
					path: {
						type: "string",
						required: true
					},
					message: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.message
			}]
		},
		presentCall: (args) => {
			const subject = args.path ?? args.old_path ?? "/memories";
			return {
				card: "generic",
				title: `Memory ${args.command}: ${subject}`,
				kind: CALL_KIND[args.command],
				rawInput: args.command === "insert" ? args.insert_text : args.file_text ?? args.new_str
			};
		},
		async execute(args, exec) {
			const message = await runCommand(new MemoryStore(await runtime.directoryFor(exec.agent?.session?.header?.cwd), { maxFileBytes: runtime.maxFileBytes() }), args);
			return {
				command: args.command,
				path: args.path ?? args.new_path ?? "/memories",
				message
			};
		}
	}));
}
/**
* Run one command and return the reply text the model reads.
* @param store - the session's memory store.
* @param args - the validated call arguments.
* @returns the command's reply, in Claude's memory-tool wording.
* @throws when the store fails outside the memory tool's own vocabulary.
*/
async function runCommand(store, args) {
	try {
		switch (args.command) {
			case "view": return await store.view(required(args.path, "path", args.command), viewRange(args.view_range));
			case "create": return await store.create(required(args.path, "path", args.command), args.file_text ?? "");
			case "str_replace": return await store.strReplace(required(args.path, "path", args.command), required(args.old_str, "old_str", args.command), args.new_str ?? "");
			case "insert": return await store.insert(required(args.path, "path", args.command), requiredNumber(args.insert_line, "insert_line", args.command), args.insert_text ?? "");
			case "delete": return await store.delete(required(args.path, "path", args.command));
			case "rename": return await store.rename(required(args.old_path, "old_path", args.command), required(args.new_path, "new_path", args.command));
			default: return `Error: unknown memory command ${JSON.stringify(args.command)}. Use one of: ${MEMORY_COMMANDS.join(", ")}.`;
		}
	} catch (error) {
		if (error instanceof MemoryPathError || error instanceof ArgumentError) return error.message;
		throw error;
	}
}
/** Reply text for a command missing one of its required fields. */
function missing(field, command) {
	return `Error: \`${field}\` is required for the ${command} command.`;
}
function required(value, field, command) {
	if (value === void 0) throw new ArgumentError(missing(field, command));
	return value;
}
function requiredNumber(value, field, command) {
	if (value === void 0) throw new ArgumentError(missing(field, command));
	return value;
}
/**
* A command's own argument refusal: reported as the reply text rather than
* thrown out of the tool, so it reads like every other memory reply.
*/
var ArgumentError = class extends Error {};
/** Normalize the optional view window into the store's tuple form. */
function viewRange(value) {
	const [start, end] = value ?? [];
	if (start === void 0 || end === void 0) return void 0;
	return [start, end];
}
//#endregion
//#region src/typert.ts
/** Wire namespace and Cordis service key of the memory-store owner. */
const REMOTE_NAMESPACE = "memoryStore";
/** Permissive strict codec: accepts any value, returns it unchanged. */
const passthrough = { parse: (value) => value };
/**
* One strict codec over {@link passthrough}.
*
* Both schema seats carry the same parse contract: a Host whose Typert registry
* materializes generated schemas requires the `create()` factory and calls it
* when a boundary first uses the codec, while an older one calls `schema.parse`.
* The published `@deepseek-ai/dsh-typert-protocol` release this package
* dev-depends on declares `schema` alone, so the literal cannot satisfy those
* types while carrying `create`; drop the assertion once a published protocol
* version declares `create`.
* @param typeSymbol - generated-style type symbol naming this codec.
* @returns the strict codec handed to `ctx.remote.$mount`.
*/
function codec(typeSymbol) {
	return {
		mode: "strict",
		typeSymbol,
		schema: passthrough,
		create: () => passthrough
	};
}
function descriptor(method) {
	const owner = `@guowenzhang/dsh-memory#${`${REMOTE_NAMESPACE}/${method}`}`;
	return {
		id: owner,
		service: REMOTE_NAMESPACE,
		namespace: REMOTE_NAMESPACE,
		method,
		invocation: { kind: "direct" },
		parameters: [{
			name: "request",
			wire: "request",
			source: "json",
			codec: codec(`${owner}:request`)
		}],
		result: codec(`${owner}:result`)
	};
}
/** Contribution mounted by the browser half to reach the memory store. */
const TYPERT_REMOTE = {
	package: "@guowenzhang/dsh-memory",
	descriptors: [
		descriptor("targets"),
		descriptor("status"),
		descriptor("readIndex"),
		descriptor("writeIndex")
	]
};
//#endregion
//#region src/index.ts
/** Cordis plugin name used by loader diagnostics. */
const name = "memory";
/** Services this plugin requires; `settings` is probed lazily. */
const inject = ["tools"];
/** Schemastery validation for {@link Config}. */
const Config = z.object({
	enabled: z.boolean().default(true),
	directory: z.string().default(DEFAULT_MEMORY_DIRECTORY),
	claudeCompatible: z.boolean().default(false),
	claudeHome: z.string(),
	indexLines: z.number().step(1).min(1).default(200),
	indexBytes: z.number().step(1).min(1).default(DEFAULT_INDEX_BYTES),
	maxFileBytes: z.number().step(1).min(1).default(DEFAULT_MEMORY_LIMITS.maxFileBytes),
	projectRootMarkers: z.array(z.string()).default([".git"])
});
/**
* Register the memory settings namespace, the `memory` tool, the contributor
* that folds the index into a session's first request, and the settings page's
* Remote namespace.
*
* The tool follows the settings switch: turning memory off withdraws the tool
* as well as stopping the injection, so a disabled deployment neither spends
* request tokens on the schema nor lets the model write memories.
* @param ctx - plugin context; every registration is disposed with it.
* @param config - composition defaults and caps.
*/
function apply(ctx, config = {}) {
	let withdrawTool;
	const syncTool = () => {
		const wanted = runtime.enabled();
		if (wanted && withdrawTool === void 0) withdrawTool = registerMemoryTool(ctx, runtime);
		if (!wanted && withdrawTool !== void 0) {
			withdrawTool();
			withdrawTool = void 0;
		}
	};
	const runtime = registerMemorySettings(ctx, config, syncTool);
	syncTool();
	memoryInstructionListener(ctx, runtime);
	new MemoryRemote(ctx, runtime);
	ctx.effect(() => () => {
		withdrawTool?.();
		withdrawTool = void 0;
	}, "memory: tool lifetime");
}
//#endregion
export { Config, DEFAULT_INDEX_BYTES, DEFAULT_INDEX_LINES, MEMORY_COMMANDS, MEMORY_INDEX_NAME, MEMORY_LOADER, MEMORY_PATH_PREFIX, MEMORY_SETTINGS_NAMESPACE, MEMORY_SETTINGS_SCHEMA, MEMORY_TOOL_NAME, MemoryPathError, MemoryStore, PLUGIN_ID, REMOTE_NAMESPACE, TYPERT_REMOTE, apply, foldMemoryInstructions, inject, isMemorySource, memoryInstructionListener, memorySource, name, projectSlug, registerMemorySettings, registerMemoryTool, renderMemoryInstructions, resolveClaudeHome, resolveMemoryDirectory, resolveMemoryPath, runCommand };
