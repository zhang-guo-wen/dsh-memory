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
  'intro': '记忆目录是 Claude 记忆目录的结构：索引 MEMORY.md 加每个记忆一个文件。会话开始时索引进入请求，模型用 memory 工具读写这个目录。把目录指向 Claude 的 ~/.claude/projects/<项目>/memory 即可直接复用它的记忆。',
  'enable.label': '启用记忆',
  'enable.desc': '把索引注入每个新会话，并注册 memory 工具',
  'directory.label': '记忆目录',
  'directory.hint': '支持 ~（用户目录）与 {project}（会话项目名，按 Claude 的 projects 目录规则生成，同一仓库的 worktree 共用）。',
  'directory.placeholder': '~/.dsh/memory',
  'directory.save': '保存',
  'directory.choose': '选择目录…',
  'directory.unsaved': '有未保存的修改',
  'status.title': '目录状态',
  'status.loading': '读取中…',
  'status.missing': '目录不存在，第一次写入时创建',
  'status.exists': '目录已存在',
  'status.files': '文件',
  'status.total': '合计',
  'status.index': '索引',
  'status.indexMissing': '还没有 MEMORY.md',
  'status.indexSize': '{lines} 行 · {size}',
  'status.truncated': '超出会话加载上限（{lines} 行 / {bytes} 字节），只注入前一部分',
  'status.cap': '单文件上限 {size}',
  'index.title': 'MEMORY.md 索引',
  'index.hint': '索引只放指针：一行一个记忆，格式 - [标题](文件.md) — 一句话说明。记忆正文写在各自的话题文件里。',
  'index.placeholder': '- [调试记录](debugging.md) — 认证令牌轮换与数据库连接排查',
  'index.save': '保存索引',
  'index.reload': '重新载入',
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
  'intro': 'The memory directory uses Claude\'s layout: an index named MEMORY.md plus one file per memory. The index enters a session\'s first request, and the model reads and writes the directory with the memory tool. Point the directory at Claude\'s ~/.claude/projects/<project>/memory to reuse those memories as they are.',
  'enable.label': 'Enable memory',
  'enable.desc': 'Fold the index into every new session and register the memory tool',
  'directory.label': 'Memory directory',
  'directory.hint': 'Accepts ~ (user home) and {project} (the session project\'s name, derived the way Claude names its projects directory; worktrees of one repository share it).',
  'directory.placeholder': '~/.dsh/memory',
  'directory.save': 'Save',
  'directory.choose': 'Choose directory…',
  'directory.unsaved': 'Unsaved change',
  'status.title': 'Directory state',
  'status.loading': 'Reading…',
  'status.missing': 'The directory does not exist yet; the first write creates it',
  'status.exists': 'The directory exists',
  'status.files': 'Files',
  'status.total': 'Total',
  'status.index': 'Index',
  'status.indexMissing': 'No MEMORY.md yet',
  'status.indexSize': '{lines} lines · {size}',
  'status.truncated': 'Over the session load limit ({lines} lines / {bytes} bytes); only the leading part is injected',
  'status.cap': 'File cap {size}',
  'index.title': 'MEMORY.md index',
  'index.hint': 'The index holds pointers only: one line per memory, formatted - [Title](file.md) — one-line hook. Memory content lives in its own topic file.',
  'index.placeholder': '- [Debugging notes](debugging.md) — auth token rotation and database connection troubleshooting',
  'index.save': 'Save index',
  'index.reload': 'Reload',
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
