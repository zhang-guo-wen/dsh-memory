# AGENTS.md

本仓 `dsh-memory` 是**独立于 harness monorepo** 的 DeepSeek Harness (DSH) 插件：
把 Claude 记忆目录（`MEMORY.md` 索引 + 每个记忆一个话题文件）与 memory 工具接进会话，目录默认每项目一份、
可自己选，也可以一个开关直接切到 Claude Code 自己的记忆目录；并提供设置页的「记忆」区块。
它不打包 `@deepseek-ai/*`，运行时从宿主 harness 解析这些包。

姊妹插件：[`dsh-claude-compat`](../dsh-claude-compat)（CLAUDE.md 指令文件、技能、作用域规则）、
[`dsh-mcp-manager`](../dsh-mcp-manager)（MCP）。三者互不 import、互不依赖，可单独安装。

## 目录

仓库根**就是**包：`package.json` 即 `@zhang-guo-wen/dsh-memory`。
这不是风格选择——`dsh plugin add <git-url>` 取的是仓库根，包放在 `packages/*` 下会被装成错误的东西。

- `src/paths.ts` —— 目录解析（`~`、`{project}`）与 `/memories` 路径寻址；越界一律抛 `MemoryPathError`。
  默认目录是 `~/.dsh/memory/{project}`（每项目一份）。
- `src/store.ts` —— 记忆目录的全部读写：`view`/`create`/`str_replace`/`insert`/`delete`/`rename` 的返回文案、
  索引读取上限、目录列举、软链接越界检查。**不抛错，返回文案**：Claude 的措辞就是契约。
- `src/settings.ts` —— `memory` 设置命名空间（`enabled` / `directory` / `claudeCompatible`）、组合层 `Config`、
  `{project}` 的项目名解析（git 仓库根 + worktree 回溯）、`claudeCompatible` 下的 Claude 目录解析。
- `src/instructions.ts` —— 注入文本与 `agent/pre-step` 监听：每个会话折叠一次，来源记为通用 `plugin` kind。
- `src/tool.ts` —— `defineTool` 的 `memory` 工具：参数表、按命令校验、卡片呈现。
- `src/remote.ts` / `src/typert.ts` / `src/types.ts` —— 设置页读写的 Typert Remote（`memoryStore`）。
- `src/client/` —— 浏览器半边：设置区块、控制器、字典、CSS module。
- `lib/` —— 构建产物：**已提交进仓库**（`index.mjs` host + `client.js` 浏览器 handoff），
  这样别人可以直接从 git 安装。改完源码**记得 `npm run build` 并把 `lib/` 一起提交**。
- `cordis.patch.yml` —— 把插件行插入组合的 bundle 层。

## 构建

```sh
npm install
npm run typecheck   # tsc --noEmit -p tsconfig.json
npm run build       # tsdown（host） + node build-client.mjs（client）
```

- host：`tsdown` 打 `src/index.ts` → `lib/index.mjs`，所有 `@deepseek-ai/*` 保持 external。
- client：`build-client.mjs`（rolldown）→ `lib/client.js`，包成 `window.__ModuleLoader__.load({ id, factory })`，
  react / `@deepseek-ai/*` external，`.module.css` 用 lightningcss 编译并内联。

**Node 不解析 TC39 装饰器。** tsdown 默认不降级装饰器，所以 `tsdown.config.ts` 里有一个
`lowerDecorators` transform（用 `typescript` 的 `transpileModule`）。少了它，`MemoryRemote` 上的 `@Remote`
会以原始语法留在 `lib/index.mjs`，host 加载即崩。

## 插件契约（Cordis）

- host 插件导出 `{ name, inject, Config, apply }`；`inject: ['tools']`，settings 用 `ctx.inject(['settings'], …)` 软探测。
- 依赖的服务用 `ctx.get('x')` 取，**不要** `ctx.x` 属性访问 —— 未 inject 的服务属性在 Cordis 的 inject guard 下会抛错。
- client 半边必须打成 `window.__ModuleLoader__.load({ id, factory })` 手接格式；id 与 `build-client.mjs`
  里的 `HANDOFF_ID` 一致。改动 client 后要 bump 它或强刷浏览器，否则浏览器一直跑旧 bundle。
- `dsh.client.inject` 必须列全 apply 用到的服务提供包（含 `dsh-client-ui-primitives`）。

## Typert Remote（设置页 ↔ Host）

host 侧：`class MemoryRemote extends TypertRemoteService`，构造里 `super(ctx, 'memoryStore')`，方法加 `@Remote('name')`。
**无条件注册** —— 守卫为假时服务根本不注册，客户端 RPC 会收到 HTTP 404。

新增一个 Remote 方法要**三处齐**：

1. `src/remote.ts` 的 `@Remote('x')` 方法（**形参必须叫 `request`**：网关按运行时参数名推导 descriptor）；
2. `src/typert.ts` 的 `TYPERT_REMOTE.descriptors` 加一行；
3. `src/client/index.ts` 的 `MemoryStoreNamespace` 接口加一行。

漏掉 descriptor 的表现是客户端调用失败 / "not mounted"。客户端贡献对象的 codec 必须 `mode: 'strict'` 且
**两种 schema 座位都要带**（`schema.parse` 与 `create()`），缺 `create()` 时 `ctx.remote.$mount` 抛
`strict codec has no create() factory`，整个 client 半边直接加载失败。

## 记忆的三个不变量

1. **返回文案就是契约。** 六个命令的成功与失败都返回 Claude memory 工具的原文（含 `Error: ` 前缀的那些），
   不抛异常——模型是按文案决策的。基础设施故障（盘满、权限）才抛。
2. **路径不越界。** 所有模型给的路径都过 `resolveMemoryPath`（拒 `..`、绝对路径、盘符），再用目录的 realpath
   检查最近存在的祖先，防止目录内软链接把写入引到外面。
3. **注入只发生一次，且记进日志。** 消息来源是 `{ kind: 'plugin', plugin: '@zhang-guo-wen/dsh-memory#memory-index' }`
   ——**绝不自造 kind**：Session 格式迁移只认发布版的 kind 表，自造 kind 会让历史会话打不开。

## 部署

```sh
pnpm dsh plugin --profile web add C:/02-codespace/deepseek-harness/dsh-memory   # 本地（symlink，重建即生效）
pnpm dsh plugin --profile web add github:zhang-guo-wen/dsh-memory               # git 源
pnpm dsh --profile web --dump-config | Select-String dsh-memory                  # 确认进了组合
```

`patchReload: live` 的 profile 会在清单变化后热重组；浏览器仍需硬刷新（boot 图是页面加载时组装的）。
client 产物变了还要 bump `HANDOFF_ID` 或强刷。

## 发版

`lib/` 提交进仓库，所以**发版 = 改版本号 + 构建 + 提交产物 + 打 tag**。

1. 改根 `package.json` 的 `version`。
2. `npm run build`，确认 `lib/index.mjs` 与 `lib/client.js` 是最新的。
3. 提交源码与 `lib/`。
4. `git tag -a v<version> -m "dsh-memory <version>"` 并 `git push origin master --follow-tags`。

## 易崩清单

1. `@Remote` 装饰器没在构建期降级 → host 加载崩。
2. 服务被守卫条件挡住没注册 → 客户端 RPC 404。
3. `ctx.x` 属性访问未 inject 的服务 → 抛错（用 `ctx.get('x')`）。
4. client 包不是 `window.__ModuleLoader__.load` 格式 → 浏览器加载失败。
5. 新 Remote 方法漏掉 `src/typert.ts` 的 descriptor → 客户端调用失败。
6. CSS module 里 JSX 引用但 CSS 未定义的类 → `undefined`，静默无样式。
7. 改 client 不 bump `HANDOFF_ID` / 不硬刷新 → 浏览器跑旧 bundle（"改动没生效"）。
8. 设置 schema 里放会拒绝值的校验 → 一个手写错的字段让整个命名空间回退；`directory` 只校验成字符串。
