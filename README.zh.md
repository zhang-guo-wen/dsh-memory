# dsh-memory

[English](README.md) | 中文

## 背景：DeepSeek Harness

DeepSeek Harness（`dsh`）是 DeepSeek AI 开源的 agent harness，几乎所有能力都是 [Cordis](https://github.com/cordiverse/cordis) 插件。它处于 **developer preview** 阶段、迭代很快，会有破坏性变更（[文档站](https://deepseek-harness.github.io/deepseek-harness/)，`0.1.7-alpha.*`）；本插件是独立第三方包，`@deepseek-ai/*` 运行时从宿主解析。

## 这个插件解决什么问题

会话一结束就什么都不记得；本插件给它一个 Claude 形态的记忆目录（`MEMORY.md` + 一个记忆一个文件）、一个 `memory` 工具和设置页区块。

## 截图

截图待补 —— 本插件目前还没有可捕获的界面截图。

## 安装

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-memory
```

来自 npm 官方源：<https://www.npmjs.com/package/@guowenzhang/dsh-memory>。装完重启宿主；本地目录开发安装、git 源与排查见 [AGENTS.md](AGENTS.md)。

## 用法

### 打开或关闭记忆

**设置 → 记忆** 的第一项是 **启用记忆**，默认开启。它是总开关：关掉后新会话不再注入索引、`memory` 工具不再注册，磁盘上已有的东西一个都不删。

### 记忆目录里有什么

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
- [build-and-test.md](build-and-test.md) — 构建约 45s，Vitest，dev server 在 3001
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

### 选择记忆目录

**记忆目录模板** 决定存储放在哪；`~` 是用户目录，`{project}` 是当前项目的目录名。

| 写法 | 解析结果 |
|---|---|
| `~/.dsh/memory/{project}`（默认） | 每个项目一个独立子目录，互不串味 |
| `~/.dsh/memory` | 所有项目共用一份（去掉 `{project}` 即为共享） |
| `~/.claude/projects/{project}/memory` | 等价于打开 **兼容 Claude 目录** 开关 |

`{project}` 取会话工作目录所属的 git 仓库根（`.git` 文件即链接 worktree，会回溯到主仓库），把 `[A-Za-z0-9]` 以外的字符全部换成 `-`：`C:\02-codespace\deepseek-harness` → `C--02-codespace-deepseek-harness`，与 Claude 写在 `~/.claude/projects/` 下的目录名一致。

**选择目录…** 在宿主提供系统选择框时打开它，否则打开内置目录浏览器；直接在输入框里填路径在任何环境下都可用。旁边的 **目录状态** 报出当前项目解析到的目录、索引的行数与字节、文件数与合计大小，以及单文件上限。

### 与 Claude Code 共用同一个目录

**兼容 Claude 目录默认关闭。** 关闭时记忆写进你自己的目录（可选、可改）；打开后不需要选目录——存储就是 Claude Code 的 `~/.claude/projects/<项目>/memory`，与 Claude 共用同一份。再关掉就回到你原先配置的目录。

### 查看另一个项目

记忆按项目存，所以设置页一次只显示一个：**目录状态** 与 **MEMORY.md 索引** 编辑器针对 **项目** 下拉里选中的那个项目。下拉内容 =

- 当前项目（宿主进程所在的那个）；
- 每个 DSH 工作区；
- 打开 **兼容 Claude 目录** 时，再加上 `<Claude 配置目录>/projects/` 下的每个项目目录。

按解析出来的目录去重，所以同一个仓库只出现一次；只有一个项目时下拉不显示。切换只影响**看和编辑哪一份**，不改模板、也不影响会话——每个会话永远按自己的工作目录解析。

### 保存一条记忆

保存是两步：先写记忆文件，再往 `MEMORY.md` 加一行指针——索引里只放指针，不放正文。这套协议由注入的 instructions 说明，模型自己执行；你也可以直接在设置页的 **MEMORY.md 索引** 编辑器里改。

### 使用 `memory` 工具

模型通过一个 `memory` 工具触达整个存储，路径统一寻址到 `/memories`；每个返回都是工具自己的原文——包括失败，它们是返回而不是抛出（`Error: File … already exists`、`Please ensure it is unique` 等）。`view` 的文件行数上限、`view_range`、目录 2 层、隐藏项与 `node_modules` 排除、`/memories` 寻址、`create` 遇已存在即失败、`str_replace` 要求唯一匹配、`insert` 的 0 基行号、`delete` 拒绝根目录、`rename` 拒绝覆盖——这些都与 Claude 的 memory 工具一致。

| 命令 | 行为 |
|---|---|
| `view` | 列目录两层，排除隐藏项与 `node_modules`；或带行号显示文件，`view_range: [start, end]` 只取窗口 |
| `create` | 写新文件并创建父目录；路径已存在即失败 |
| `str_replace` | 替换必须唯一出现的 `old_str`；出现多次时报出行号 |
| `insert` | 在第 `insert_line` 行（0 基）插入文本 |
| `delete` | 删除文件，或删除目录及其内容；拒绝 `/memories` 根 |
| `rename` | 移动条目；拒绝覆盖已存在的目标 |

### 会话加载什么

每个会话的第一次请求折叠一条 instructions 消息：记忆协议加当前 `MEMORY.md` 的前 **200 行或 25 KB**——与 Claude 的加载上限相同。该消息记进 Session 日志，恢复的会话不会重复注入；这个上限是**加载**上限而不是裁剪，索引剩下的部分留在磁盘上、不进请求。

## 注意事项

- **不写 frontmatter 的 `modified` 时间戳。** Claude Code 用普通文件工具写入时会补一个 ISO-8601 时间戳；本插件让「模型写什么，文件里就是什么」，不做隐式改写。
- **单文件上限 1 MiB。** 本插件读写单个记忆文件的默认上限就是 1 MiB。
- **`#` 快捷追加不是本插件的能力**：Claude 现行官方文档里也没有这个前缀（交互模式文档只列了 `/`、`!`、`@`、`:`、`?`）。要手动记一条，直接在设置页编辑索引，或让模型用 `memory` 工具写入。
- **不做自主维护**：插件不会自己总结、归档或删除记忆——写入只发生在模型调用 `memory` 工具时，删除只能由模型的 `delete` 或你在设置页手动发起。
- **记忆目录之外的路径一律拒绝**：`../`、绝对路径、盘符路径都不会逃出 `/memories`，目录内的软链接也无法把写入引到外面。
- **新的设置区块要硬刷新浏览器**（Ctrl+F5），因为页面持的是它加载时的 boot 图；只重启宿主不会重建它。
- **CLAUDE.md 一类的指令文件不属于本插件**——那是 [`@guowenzhang/dsh-claude-compat`](https://github.com/zhang-guo-wen/dsh-claude-compat) 的职责。两者互不依赖，可单独安装。

## 许可

插件本体是 Apache-2.0——见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。插件契约、设置区块与 Remote 界面中有部分派生自 DeepSeek Harness，这些部分仍按 MIT 许可，原文收在 [NOTICE](NOTICE) 里。

## 延伸阅读

- [AGENTS.md](AGENTS.md) —— 安装的各种变体、插件如何被组合进 profile、每个配置字段与默认值、构建与部署语义、发版步骤与排查。
- [docs/implementation.md](docs/implementation.md) —— 实现参考：目录解析、存储、注入时机与设置页的 Remote。
- [tests/README.md](tests/README.md) —— spec 运行方式与每个 spec 的覆盖范围。
- [@guowenzhang/dsh-claude-compat](https://github.com/zhang-guo-wen/dsh-claude-compat) —— 姊妹插件，负责 `CLAUDE.md` 指令文件、技能与作用域规则。
- [@guowenzhang/dsh-mcp-manager](https://github.com/zhang-guo-wen/dsh-mcp-manager) —— 姊妹插件，负责 MCP。
- [DeepSeek Harness 文档](https://deepseek-harness.github.io/deepseek-harness/)。
