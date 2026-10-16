---
paths:
  - "src/index.ts"
  - "src/client/index.ts"
  - "cordis.patch.yml"
  - "package.json"
  - "lib/**"
---

> 覆盖什么、何时读：要判断一段改动该落在哪个模块、确认 `lib/` 产物的形态，或核对 `cordis.patch.yml` 与 `package.json` 的组合接线时读本文件。

# 目录、模块与组合接线

## 目录

仓库根**就是**包：`package.json` 即 `@guowenzhang/dsh-memory`。
这不是风格选择——`dsh plugin add <git-url>` 取的是仓库根，包放在 `packages/*` 下会被装成错误的东西。

- `src/paths.ts` —— 目录解析（`~`、`{project}`）与 `/memories` 路径寻址；越界一律抛 `MemoryPathError`。
  默认目录是 `~/.dsh/memory/{project}`（每项目一份）。
- `src/store.ts` —— 记忆目录的全部读写：`view`/`create`/`str_replace`/`insert`/`delete`/`rename` 的返回文案、
  索引读取上限、目录列举、软链接越界检查。**不抛错，返回文案**：Claude 的措辞就是契约。
- `src/settings.ts` —— `memory` 设置命名空间（`enabled` / `directory` / `claudeCompatible`）、组合层 `Config`、
  `{project}` 的项目名解析（git 仓库根 + worktree 回溯）、`claudeCompatible` 下的 Claude 目录解析。
- `src/instructions.ts` —— 注入文本与 `agent/pre-step` 监听：每个会话折叠一次，来源是本插件自己的
  `plugin:@guowenzhang/dsh-memory#memory-index` kind。
- `src/tool.ts` —— `defineTool` 的 `memory` 工具：参数表、按命令校验、卡片呈现。
- `src/remote.ts` / `src/typert.ts` / `src/types.ts` —— 设置页读写的 Typert Remote（`memoryStore`：`targets` /
  `status` / `readIndex` / `writeIndex`）。
- `src/targets.ts` —— 设置页可选的项目：当前项目、`ctx.workspaceRegistry` 的工作区、（Claude 目录模式下）
  `<Claude 配置目录>/projects/*`；按解析出的目录去重，未知选择 id 回落当前项目，实际用的 id 回显在 `status.target`。
- `src/client/` —— 浏览器半边：设置区块、控制器、字典、CSS module。
- `lib/` —— 构建产物：**已提交进仓库**（`index.mjs` host + `client.js` 浏览器 handoff），
  这样别人可以直接从 git 安装。改完源码**记得 `npm run build` 并把 `lib/` 一起提交**。
- `cordis.patch.yml` —— 把插件行插入组合的 bundle 层。

## 组合接线

`cordis.patch.yml` 把插件行插进组合的 bundle 层：

```yaml
- insert:
    - id: memory
      name: '@guowenzhang/dsh-memory'
```

`package.json` 的 `dsh.bundle.patch` 指向这份 patch，`dsh.client.inject` 列全浏览器半边 apply 用到的服务提供包（`@deepseek-ai/dsh-api-gateway`、`@deepseek-ai/dsh-api-remotes`、`@deepseek-ai/dsh-api-workspace-controller`、`@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-renderer`、`@deepseek-ai/dsh-client-ui-settings`、`@deepseek-ai/dsh-client-ui-slots`），`platform` 为 `web`。`exports` 另导出 `./client`（`lib/client.js`）与 `./cordis.patch.yml`。
