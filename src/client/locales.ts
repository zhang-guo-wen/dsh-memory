/**
 * Memory settings section dictionaries.
 *
 * The page states the memory directory, what the Host does with it, and the
 * index the next session loads, so an operator can point memory at an existing
 * Claude Code `memory/` directory without reading the README. Each key of the
 * Chinese dictionary is part of {@link MemorySectionKey}, and `en` is typed
 * against it, so a new entry cannot ship untranslated.
 *
 * @module @zhang-guo-wen/dsh-memory/client/locales
 */

/** Locale namespace owned by this plugin. */
export const NS = 'settings.memory'

const zh = {
  'nav': '记忆',
  'enable.label': '启用记忆',
  'enable.desc': '把索引注入每个新会话，并注册 memory 工具',
  'claude.label': '兼容 Claude 目录',
  'claude.desc': '直接读写 Claude Code 的 ~/.claude/projects/<项目>/memory，与 Claude 共用同一份记忆；开启后不用选目录',
  'directory.label': '记忆目录模板',
  'directory.hint': '这里填的是模板：{project} 替换成当前项目的目录名（按 Claude 的 projects 命名规则，同一仓库的 worktree 共用同一个），~ 表示用户目录；去掉 {project} 就是所有项目共用一份。',
  'directory.placeholder': '~/.dsh/memory/{project}',
  'directory.save': '保存',
  'directory.choose': '选择目录…',
  'directory.unsaved': '有未保存的修改',
  'status.title': '目录状态',
  'status.resolved': '实际使用目录',
  'status.loading': '读取中…',
  'status.missing': '目录不存在，第一次写入时创建',
  'status.exists': '目录已存在',
  'status.files': '文件',
  'status.filesValue': '{count} 个 · 合计 {size}',
  'status.index': '索引',
  'status.indexMissing': '还没有 MEMORY.md',
  'status.indexSize': '{lines} 行 · {size}',
  'status.truncated': '超出会话加载上限（{lines} 行 / {bytes} 字节），只注入前一部分',
  'status.cap': '单文件上限',
  'index.title': 'MEMORY.md 索引',
  'index.hint': '索引只放指针：一行一个记忆，格式 - [标题](文件.md) — 一句话说明。记忆正文写在各自的话题文件里。',
  'index.placeholder': '- [调试记录](debugging.md) — 认证令牌轮换与数据库连接排查',
  'index.save': '保存索引',
  'index.reload': '重新载入',
  'targets.label': '项目',
  'targets.hint': '状态与索引针对哪个项目：列表来自 DSH 工作区；打开「兼容 Claude 目录」后还会列出 Claude 的项目目录。',
  'targets.current': '当前项目',
  'browser.title': '选择记忆目录',
  'browser.here': '当前：{path}',
  'browser.parent': '上一级',
  'browser.use': '用这个目录',
  'browser.cancel': '取消',
  'browser.empty': '没有子目录',
  'unavailable': '设置当前不可用',
  'refreshing': '刷新中…',
  'notice.directorySaved': '目录已保存',
} as const

/** Key union, sourced from the Chinese dictionary. */
export type MemorySectionKey = keyof typeof zh

const en: Record<MemorySectionKey, string> = {
  'nav': 'Memory',
  'enable.label': 'Enable memory',
  'enable.desc': 'Fold the index into every new session and register the memory tool',
  'claude.label': 'Use Claude\'s directory',
  'claude.desc': 'Read and write Claude Code\'s own ~/.claude/projects/<project>/memory, sharing those memories with Claude; no directory to choose while it is on',
  'directory.label': 'Memory directory template',
  'directory.hint': 'This is a template: {project} is replaced by the current project\'s directory name (named the way Claude names its projects; worktrees of one repository share it) and ~ is the user home; drop {project} to share one store across projects.',
  'directory.placeholder': '~/.dsh/memory/{project}',
  'directory.save': 'Save',
  'directory.choose': 'Choose directory…',
  'directory.unsaved': 'Unsaved change',
  'status.title': 'Directory state',
  'status.resolved': 'Resolved for this project',
  'status.loading': 'Reading…',
  'status.missing': 'The directory does not exist yet; the first write creates it',
  'status.exists': 'The directory exists',
  'status.files': 'Files',
  'status.filesValue': '{count} · {size} total',
  'status.index': 'Index',
  'status.indexMissing': 'No MEMORY.md yet',
  'status.indexSize': '{lines} lines · {size}',
  'status.truncated': 'Over the session load limit ({lines} lines / {bytes} bytes); only the leading part is injected',
  'status.cap': 'File cap',
  'index.title': 'MEMORY.md index',
  'index.hint': 'The index holds pointers only: one line per memory, formatted - [Title](file.md) — one-line hook. Memory content lives in its own topic file.',
  'index.placeholder': '- [Debugging notes](debugging.md) — auth token rotation and database connection troubleshooting',
  'index.save': 'Save index',
  'index.reload': 'Reload',
  'targets.label': 'Project',
  'targets.hint': 'Which project the state and the index describe: the list comes from DSH workspaces, plus Claude\'s project directories while Claude-directory mode is on.',
  'targets.current': 'Current project',
  'browser.title': 'Choose the memory directory',
  'browser.here': 'Current: {path}',
  'browser.parent': 'Up',
  'browser.use': 'Use this directory',
  'browser.cancel': 'Cancel',
  'browser.empty': 'No subdirectories',
  'unavailable': 'Settings are unavailable',
  'refreshing': 'Refreshing…',
  'notice.directorySaved': 'Directory saved',
}

export { en, zh }
