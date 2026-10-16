# 配置字段与目录解析

**何时读我**：要改 `src/settings.ts` 的字段、回答「记忆目录在哪、怎么改」，或核对默认值与上限时读本文件。逐字段使用说明见 [`docs/implementation.zh.md`](../docs/implementation.zh.md) 的「使用」章。

## 配置

所有字段都有可用默认值。设置页的「记忆」区块写 `enabled`、`claudeCompatible` 与 `directory`，其余是组合层字段（`claudeHome`、`indexLines`、`indexBytes`、`maxFileBytes`、`projectRootMarkers`）。

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

目录解析：`~` 展开为进程用户目录；`{project}` 换成会话项目的 Claude 风格目录名——取会话工作目录所属 git 仓库根
（`.git` 是文件时按 `gitdir:` 回溯到主仓库），把 `[A-Za-z0-9]` 以外的字符全换成 `-`，不在仓库里就用工作目录本身。
解析按会话进行，所以默认的 `~/.dsh/memory/{project}` 天然让每个项目一份存储。打开 `claudeCompatible` 后目录改为
`<Claude 配置目录>/projects/<项目>/memory`；该模式下 `directory` 是被忽略而不是被清空，关掉开关就回到原先配置的目录。

设置页可选的项目（`src/targets.ts`）：当前项目、`ctx.workspaceRegistry` 的工作区、（Claude 目录模式下）
`<Claude 配置目录>/projects/*`；按解析出的目录去重，未知选择 id 回落当前项目，实际用的 id 回显在 `status.target`。
