# AGENTS.md

本仓 `dsh-memory` 是**独立于 harness monorepo** 的 DeepSeek Harness (DSH) 插件：把 Claude 记忆目录
（`MEMORY.md` 索引 + 每个记忆一个话题文件）与 memory 工具接进会话，目录默认每项目一份、可自己选，也可以一个开关
直接切到 Claude Code 自己的记忆目录；并提供设置页的「记忆」区块。它不打包 `@deepseek-ai/*`，运行时从宿主 harness 解析这些包。

姊妹插件：[`dsh-claude-compat`](../dsh-claude-compat)（CLAUDE.md 指令文件、技能、作用域规则）、
[`dsh-mcp-manager`](../dsh-mcp-manager)（MCP）。三者互不 import、互不依赖，可单独安装。

## 目录

仓库根**就是**包：`package.json` 即 `@guowenzhang/dsh-memory`。这不是风格选择——`dsh plugin add <git-url>`
取的是仓库根，包放在 `packages/*` 下会被装成错误的东西。

- `src/` host 半边（`paths` / `store` / `settings` / `instructions` / `tool` / `remote` / `typert` / `targets`）；
  `src/client/` 浏览器半边（设置区块、控制器、字典、CSS module）。逐文件职责见 `.claude/rules/architecture.md`。
- `lib/` 构建产物（`index.mjs` host + `client.js` 浏览器 handoff）**已提交进仓库**，别人可以直接从 git 安装；
  改完源码**记得 `npm run build` 并把 `lib/` 一起提交**。
- `tests/` spec、`docs/` 维护者文档、`cordis.patch.yml` 组合插件行。
- `.claude/rules/` 本文件的明细，**按需读取**（加载机制见下）；它**不进 npm 包**（`package.json` 的 `files` 未列它），不要为了打包把它移进 `docs/`。

## 构建与测试

```sh
npm install
npm run typecheck   # tsc --noEmit -p tsconfig.json
npm run build       # tsdown（host） + node build-client.mjs（client）

# 全量（推荐）：用旁边 harness checkout 的 vitest，经 tsconfig.base.json 的 paths 解析 @deepseek-ai/*
node_modules/.bin/vitest run --root dsh-memory --config vitest.harness.config.ts
# 自足子集：用本包自己的 node_modules，只跑 tests/**/*.spec.ts
node_modules/.bin/vitest run --root dsh-memory
```

## 硬约束

- **文案就是契约**：六个命令成功与失败都返回 Claude memory 原文（含 `Error: ` 前缀），不抛异常；只有盘满、权限这类基础设施故障才抛。
- **路径不越界**：模型给的路径必过 `resolveMemoryPath`（拒 `..`、绝对路径、盘符），再按 realpath 校验最近存在的祖先，防软链接外引。
- **注入只发生一次**：来源是本插件自己声明合并进 `MessageSourceMap` 的 `plugin:@guowenzhang/dsh-memory#memory-index`；
  **绝不**写回通用 `{ kind: 'plugin', plugin }`（V4 会话直接拒绝，注入落不进日志）。
- **不自主维护**：不总结、不归档、不清理，删除只由模型的 `delete` 或用户在设置页手动发起；**默认永不静默删除用户记忆**，
  真要引入归档也只能移动、必须可配置、默认关闭。
- **未明确要求不发版**：不自行递增版本号、打 tag，也不改已推送的 tag。
- **构建红线**：`@Remote` 必须经 `tsdown.config.ts` 的 `lowerDecorators` 降级，否则 host 加载即崩；依赖服务用 `ctx.get('x')`，
  **不要** `ctx.x`；Remote 服务**无条件注册**，新增方法**三处齐**（`src/remote.ts` 形参必须叫 `request`、`src/typert.ts` descriptors、
  `src/client/index.ts`）。
- **依赖口径**：`@deepseek-ai/dsh-*` 与 `engines.dsh` 统一 `>=0.1.7-0`，`*` 等于没声明；升 harness 时联动改这里并跑全量 spec。
- **生效语义**：host 半边是进程内模块，重建 `lib/index.mjs` 不替换运行中的代码，改源码必须**重启宿主**；
  client 半边刷新页面即生效，改 client 要 bump `HANDOFF_ID`。

## 规则加载机制（`.claude/rules/`）

明细都在 `.claude/rules/*.md`，由 `dsh-claude-compat` 按 Claude Code 的作用域规则加载：

- 每个文件带**非空 `paths:`** frontmatter（项目根相对、正斜杠 glob）。**带 `paths:` 的**在你 `read` 到匹配 glob 的文件后、
  于**下一次请求**注入，每会话至多一次；这正是「按需」的含义。**不带 `paths:` 的**会像 `CLAUDE.md` 一样每次会话首次请求就注入，
  所以明细一律带 `paths:`。
- 规则**成组加载**：一次 `read` 命中的**所有**规则一起折进下一次请求，所以各文件挂的是互不重叠的窄 glob
  （如 `src/store.ts`、`src/instructions.ts`、`tests/**`），避免多个大主题叠在一次读取上。
- 需要时也可以**主动读取**对应的 `.claude/rules/*.md`，不必等命中 glob。

## 详细规则

每条明细都按需读取，每个文件开头一句写了「覆盖什么、何时读」：

- [.claude/rules/architecture.md](.claude/rules/architecture.md)：`src/` 各模块职责、`lib/` 产物形态、`cordis.patch.yml` 与 `dsh.client.inject` 组合接线。
- [.claude/rules/storage.md](.claude/rules/storage.md)：记忆目录与 `MEMORY.md` 索引的存储格式、六个命令的文案契约、路径与容量边界。
- [.claude/rules/injection.md](.claude/rules/injection.md)：注入时机与来源 kind、`MessageSourceMap`、V3→V4 迁移与旧包装兼容。
- [.claude/rules/maintenance.md](.claude/rules/maintenance.md)：不做自主维护的边界与 2026-09-20 决策。
- [.claude/rules/config.md](.claude/rules/config.md)：配置字段默认值表、`~` 与 `{project}` 目录解析、设置页项目下拉。
- [.claude/rules/cordis.md](.claude/rules/cordis.md)：Cordis 插件契约、Typert Remote「三处齐」与 strict codec 要求。
- [.claude/rules/build-and-test.md](.claude/rules/build-and-test.md)：构建流水线与依赖口径、两条 vitest 命令与 spec 覆盖范围。
- [.claude/rules/deploy-and-release.md](.claude/rules/deploy-and-release.md)：部署与安装命令、host/client 生效语义、发版与打 tag 步骤。
- [.claude/rules/pitfalls.md](.claude/rules/pitfalls.md)：易崩清单 10 条与历史排查记录。
