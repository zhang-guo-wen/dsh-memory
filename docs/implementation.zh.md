---
description: "DeepSeek Harness 的 Claude 兼容记忆：记忆目录、memory 工具、会话注入与设置页。"
kind: "package-reference"
---

# @zhang-guo-wen/dsh-memory

[English](implementation.md) | 中文

> 面向上手的说明见[仓库 README](../README.zh.md)；本文是实现参考。

## 摘要

Claude 把记忆放在一个目录里：索引文件 `MEMORY.md` 加每个记忆一个话题文件，用 `memory` 工具的六个命令、以
`/memories` 寻址读写。本包把这套存储挂到**操作者选定的目录**上：会话第一次请求带上记忆协议与加载好的索引，
模型用工具维护存储，设置页可以把目录指到任意文件夹——包括 Claude Code 自己的 `projects/<项目>/memory`。

## 目录

- [使用](#use-this-package)
- [实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用

和工具注册表一起挂载；它依赖 `ctx.tools`。profile 的 `patch` 或 preset 组合按普通插件插入即可。

```yaml
- name: '@deepseek-ai/dsh-tools'
- name: '@zhang-guo-wen/dsh-memory'
  config:
    directory: '~/.claude/projects/{project}/memory'
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `true` | 是否注入索引并注册 `memory` 工具 |
| `directory` | `~/.dsh/memory` | 记忆目录；展开 `~` 与 `{project}` |
| `indexLines` | `200` | 每次会话加载的索引行数上限 |
| `indexBytes` | `25600` | 每次会话加载的索引字节上限 |
| `maxFileBytes` | `1048576` | 单个记忆文件的读写上限 |
| `projectRootMarkers` | `['.git']` | 识别项目根的目录项 |

`enabled` 与 `directory` 同时是 `memory` 设置命名空间的字段，操作者不用改组合就能搬动存储。

### 目录解析

`~` 展开为进程用户目录。`{project}` 换成会话项目的 Claude 风格目录名：取会话工作目录所属 git 仓库根
（`.git` 是文件时按 `gitdir:` 回溯到主仓库），把 `[A-Za-z0-9]` 以外的字符全部换成 `-`；不在仓库里就用工作目录本身。
解析按会话进行，所以 `{project}` 模板天然让每个项目一份存储。

### `memory` 工具

| 命令 | 必填 | 行为 |
|---|---|---|
| `view` | `path` | 列目录（2 层，排除隐藏项与 `node_modules`），或带行号显示文件；`view_range: [start, end]` 取窗口，末尾 `-1` 表示到文件尾 |
| `create` | `path`、`file_text` | 新建文件（自动建父目录）；路径已存在则失败 |
| `str_replace` | `path`、`old_str` | 替换必须唯一出现的文本；多次出现时报告行号 |
| `insert` | `path`、`insert_line`、`insert_text` | 在 `[0, 行数]` 的 0 基行号处插入 |
| `delete` | `path` | 删除文件，或递归删除目录；拒绝 `/memories` 根 |
| `rename` | `old_path`、`new_path` | 移动条目；目标已存在则拒绝 |

每条返回都是 memory 工具自己的措辞——**失败也返回文案而不是抛异常**，因为模型是按这段文字决定下一步的。
记忆根之外的路径返回 `Path must start with /memories, got: <path>`。

-----

<a id="understand-the-implementation"></a>
## 实现

<details>
<summary>实现细节——点击展开</summary>

### 设计要点

存储是真实目录而不是虚拟文件系统：`/memories` 只是一套寻址词，配置的目录才是它在一个会话里的含义。由此有两条规则。
其一，模型给的路径必须先过 `resolveMemoryPath`（拒 `..`、绝对路径、盘符），再用最近存在的祖先的 realpath 与根的
realpath 比对，目录内的软链接无法把写入引到外面。其二，成功与拒绝都返回 Claude 的原文：模型的下一步取决于那段文字，
换成 harness 的异常渲染就丢掉了这个契约。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](../src/index.ts) | 插件入口：设置命名空间、工具、注入器、Remote |
| [`src/paths.ts`](../src/paths.ts) | `~` 与 `{project}` 展开、`/memories` 寻址、显示路径 |
| [`src/store.ts`](../src/store.ts) | 六个命令、索引加载与上限、目录列举、越界检查 |
| [`src/settings.ts`](../src/settings.ts) | `memory` 命名空间、组合配置、项目名解析 |
| [`src/instructions.ts`](../src/instructions.ts) | 注入文本、消息来源、`agent/pre-step` 折叠 |
| [`src/tool.ts`](../src/tool.ts) | `defineTool` 定义、按命令校验参数、调用卡片 |
| [`src/remote.ts`](../src/remote.ts) | `memoryStore` Remote：状态、读索引、写索引 |
| [`src/typert.ts`](../src/typert.ts) | 浏览器半边手写的 Remote 贡献对象 |
| [`src/client/`](../src/client) | 设置区块、控制器、字典、样式 |
| — | 不发布运行时 invariant 伴生包：本包除工具注册表、Session 日志与记忆目录本身之外，没有独立的事件序列或可变关系。 |

### 注入时机

注入器监听 `agent/pre-step`，取 `next()` 返回的决策，在**第一个带用户消息的 step** 里把一条 `instructions` 消息插在
最后一条被接纳的用户消息之后。消息以通用 `plugin` 来源记录
（`@zhang-guo-wen/dsh-memory#memory-index`），所以已经带它的会话（恢复的、或挂载插件后继续的）不会重复注入，
Session 格式里也只会出现发布版能产出的来源 kind。

### 设置页读的是什么

设置区块不是会话作用域，所以 `memoryStore.status` 报告的是**宿主进程所在项目**解析出的目录，并同时给出
`configured`（原始模板）与 `projectScoped`。从页面写索引与模型写索引走同一个 store，因此共用同一个 1 MiB 上限。

</details>

-----

<a id="model-experience"></a>
## 模型体验

### `memory` 工具

**模型看到什么**：一个名为 `memory` 的工具，九个可选字段加一个必填的 `command` 枚举（六个动词）。每条返回都是该结果的
原文，例如 `File created successfully at: /memories/notes.md`、`Error: File /memories/notes.md already exists`、
``No replacement was performed. Multiple occurrences of old_str `x` in lines: 2, 5. Please ensure it is unique``。

**Token 影响**：工具 schema 常驻每次请求，约 250 token。调用返回是一句话，`view` 另加它要求的内容——
受文件本身约束（超过 999,999 行的文件只报告不打印；超过 `maxFileBytes` 的文件拒绝读取）。

**KV Cache 影响**：工具 schema 跨请求稳定；返回像其它工具结果一样追加在末尾，不重排已有内容。

### 记忆注入

**模型看到什么**：会话第一次请求里一条 `instructions` 形式的用户消息，来源
`@zhang-guo-wen/dsh-memory#memory-index`：记忆协议（目录路径、一个记忆一个文件的 frontmatter、两步保存、
四类记忆、绝对日期）加 `## Memory index` 与加载好的 `MEMORY.md`。

**Token 影响**：协议正文约 450 token；索引最多 `indexLines` 行且不超过 `indexBytes`（默认 200 行 / 25 KB，
与 Claude 相同）。被截断时有一行说明。

**KV Cache 影响**：每条会话只折叠一次，之后不再变化，因此留在可复用的请求前缀里。模型自己的写入落到存储而不是
对话记录：会话中途保存记忆不会重写前缀。

-----

<a id="known-limitations-and-deferred-work"></a>
## 已知限制

以下是当前包的约束，不是待办清单。

- **不写 frontmatter 的 `modified` 时间戳。** Claude Code 用普通文件工具写入时会补 ISO-8601 时间戳；本存储只写
  传入的文本，绝不隐式改写文件自己的 frontmatter。
- **一个配置目录一个存储。** 除 `{project}` 之外更细的按会话/按工作区划分，需要设置页无法表达的字段
  （命名空间是宿主级的）。
- **设置页不建目录。** 内置浏览器只列举与选择；建文件夹交给系统选择框，或直接在输入框里手写路径。
