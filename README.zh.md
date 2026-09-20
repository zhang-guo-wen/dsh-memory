# dsh-memory

[English](README.md) | 中文

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）用的独立插件：**一个目录形态的记忆**，
结构、索引格式与工具协议都照 Claude 的记忆做，目录由你自己选——包括直接指向 Claude Code 自己的
`~/.claude/projects/<项目>/memory`。

它不打包 `@deepseek-ai/*`，运行时从宿主 harness 解析这些包。

## 做什么

- **记忆目录**：`MEMORY.md` 索引 + 每个记忆一个话题文件，与 Claude 的自动记忆目录同构；默认 **每个项目一个子目录**。
- **memory 工具**：`view` / `create` / `str_replace` / `insert` / `delete` / `rename` 六个命令，路径统一寻址到
  `/memories`，返回文案沿用 Claude 的措辞（含 `Error: File … already exists`、`Please ensure it is unique` 等）。
- **会话注入**：每个会话的第一次请求折叠一条 instructions 消息——记忆协议 + 当前 `MEMORY.md`（前 200 行或 25 KB，
  与 Claude 相同）。该消息记进 Session 日志，恢复的会话不会重复注入。
- **设置页「记忆」区块**：总开关、「兼容 Claude 目录」开关、目录输入框 + 目录选择器（原生选择框，宿主只有浏览能力时
  退化为内置目录浏览器）、目录状态（索引行数/字节、文件数与合计）、`MEMORY.md` 编辑器。

**「兼容 Claude 目录」默认关闭。** 关闭时记忆写进你自己的目录（可选、可改）；打开后不需要选目录，直接读写 Claude Code 的
`~/.claude/projects/<项目>/memory`——与 Claude 共用同一份记忆。见 [README.zh.md 配置](#配置)。

CLAUDE.md 一类的指令文件**不属于**本插件：那是 [`@zhang-guo-wen/dsh-claude-compat`](https://github.com/zhang-guo-wen/dsh-claude-compat)
的职责。两者互不依赖，可单独安装。

## 安装

`lib/` 是提交进仓库的构建产物，仓库根即包，装完即可运行。

```sh
# git 源（HTTPS / SSH）
npx @deepseek-ai/dsh plugin --profile web add git+https://github.com/zhang-guo-wen/dsh-memory.git
npx @deepseek-ai/dsh plugin --profile web add git+ssh://git@github.com/zhang-guo-wen/dsh-memory.git

# 本地开发（pnpm 建 symlink，重建 lib/ 后重启即生效，无需重装）
npx @deepseek-ai/dsh plugin --profile web add /absolute/path/to/dsh-memory

# 按 tag 固定版本
npx @deepseek-ai/dsh plugin --profile web add "git+ssh://git@github.com/zhang-guo-wen/dsh-memory.git#v0.1.0"
```

装完重启宿主（或在 `patchReload: live` 的 profile 里等热重组），然后**硬刷新浏览器**（Ctrl+F5）——浏览器持有旧的
boot 图，不刷新看不到新的设置区块。

卸载：`npx @deepseek-ai/dsh plugin --profile web remove @zhang-guo-wen/dsh-memory`。

## 配置

所有字段都有可用默认值；设置页的「记忆」区块可改 `enabled` 与 `directory`，其余是组合层字段。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `true` | 是否注入索引并注册 `memory` 工具 |
| `claudeCompatible` | `false` | 直接使用 Claude Code 的记忆目录；开启时 `directory` 被忽略，不用选目录 |
| `directory` | `~/.dsh/memory/{project}` | 记忆目录；支持 `~` 与 `{project}` |
| `claudeHome` | `$CLAUDE_CONFIG_DIR` / `$CLAUDE_HOME` / `~/.claude` | Claude 配置目录；「兼容 Claude 目录」下用它定位 `projects/<项目>/memory` |
| `indexLines` | `200` | 每次会话加载的索引行数上限（与 Claude 相同） |
| `indexBytes` | `25600` | 每次会话加载的索引字节上限（与 Claude 相同） |
| `maxFileBytes` | `1048576` | 单个记忆文件的读写上限 |
| `projectRootMarkers` | `['.git']` | 向上寻找项目根时认的目录项 |

### 目录写法

| 写法 | 解析结果 |
|---|---|
| `~/.dsh/memory/{project}`（默认） | 每个项目一个独立子目录，互不串味 |
| `~/.dsh/memory` | 所有项目共用一份（去掉 `{project}` 即为共享） |
| `~/.claude/projects/{project}/memory` | 等价于打开「兼容 Claude 目录」开关 |

`{project}` 取会话工作目录所属的 git 仓库根（`.git` 文件即链接 worktree，会回溯到主仓库），把
`[A-Za-z0-9]` 以外的字符全部换成 `-`：`C:\02-codespace\deepseek-harness` → `C--02-codespace-deepseek-harness`，
与 Claude 写在 `~/.claude/projects/` 下的目录名一致。

## 目录长什么样

```
<memory>/
├── MEMORY.md          # 索引：一行一个记忆，无 frontmatter，会话开始时加载
├── debugging.md       # 一个记忆一个文件，带 frontmatter
└── ...
```

索引行格式：

```markdown
# Memory Index

## Project
- [build-and-test.md](build-and-test.md) — npm run build（约 45s），Vitest，dev server 在 3001
- [architecture.md](architecture.md) — API client 单例，refresh-token 鉴权
```

话题文件格式：

```markdown
---
name: debugging-patterns
description: 认证令牌轮换与数据库连接排查
metadata:
  type: reference
---

## 认证令牌
...
```

保存是两步：先写记忆文件，再往 `MEMORY.md` 加一行指针（索引里不写正文）。这套流程由注入的 instructions
说明，模型自己执行；你也可以在设置页直接编辑索引。

## 与 Claude 的差异

- **不写 frontmatter 的 `modified` 时间戳。** Claude Code 用普通文件工具写入时会补一个 ISO-8601 时间戳；
  本插件让「模型写什么，文件里就是什么」，不做隐式改写。
- **单文件上限 1 MiB**（可配）。`view` 的文件行数上限、`view_range`、目录 2 层、隐藏项与 `node_modules` 排除、
  `/memories` 寻址、`create` 遇已存在即失败、`str_replace` 要求唯一匹配、`insert` 的 0 基行号、
  `delete` 递归但拒绝根目录、`rename` 拒绝覆盖——这些都与 Claude 的 memory 工具一致。
- **`#` 快捷追加不是本插件的能力**：Claude 现行官方文档里也没有这个前缀（交互模式文档只列了
  `/`、`!`、`@`、`:`、`?`）。要手动记一条，直接在设置页编辑索引，或让模型用 `memory` 工具写入。
- 记忆目录之外的路径一律拒绝：`../`、绝对路径、盘符路径都不会逃出 `/memories`，目录内的软链接也会被识别。

## 开发

见 [AGENTS.md](AGENTS.md)；实现说明见 [docs/implementation.md](docs/implementation.md)；测试见 [tests/README.md](tests/README.md)。
