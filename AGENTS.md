# AGENTS.md

本仓 `dsh-memory` 是**独立于 harness monorepo** 的 DeepSeek Harness (DSH) 插件：
把 Claude 记忆目录（`MEMORY.md` 索引 + 每个记忆一个话题文件）与 memory 工具接进会话，目录默认每项目一份、
可自己选，也可以一个开关直接切到 Claude Code 自己的记忆目录；并提供设置页的「记忆」区块。
它不打包 `@deepseek-ai/*`，运行时从宿主 harness 解析这些包。

姊妹插件：[`dsh-claude-compat`](../dsh-claude-compat)（CLAUDE.md 指令文件、技能、作用域规则）、
[`dsh-mcp-manager`](../dsh-mcp-manager)（MCP）。三者互不 import、互不依赖，可单独安装。

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

## 构建

```sh
npm install
npm run typecheck   # tsc --noEmit -p tsconfig.json
npm run build       # tsdown（host） + node build-client.mjs（client）
```

- host：`tsdown` 打 `src/index.ts` → `lib/index.mjs`，所有 `@deepseek-ai/*` 保持 external。
- client：`build-client.mjs`（rolldown）→ `lib/client.js`，包成 `window.__ModuleLoader__.load({ id, factory })`，
  react / `@deepseek-ai/*` external，`.module.css` 用 lightningcss 编译并内联。
- `devDependencies` 里的 `@deepseek-ai/*` **钉死在验证过的版本**（当前 `0.1.7-alpha.2`，与 harness checkout 的
  `package.json` 一致），不写 `^`：这些包就是编译时的接口面，`^` 会解析到更高的预发布版把接口换掉，而运行时用的是
  宿主那一份。升 harness 时连同这里一起改，再跑 `npm run typecheck` 与全量 spec。

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
3. **注入只发生一次，且记进日志。** 消息来源是本插件**自己声明的** kind
   `plugin:@guowenzhang/dsh-memory#memory-index`（`MessageSourceMap` 声明合并）——harness 已经废掉通用的
   `{ kind: 'plugin', plugin }` 包装：V4 会话拒绝它，V3→V4 迁移把旧记录写成 `plugin:<plugin>`，所以声明成同一个
   拼法，恢复的旧会话与新会话才对得上一个身份。`isMemorySource` 仍认旧的包装，只为不重复注入，绝不再写它。

## 边界：不做自主维护

**插件不总结、不归档、不清理。** 没有自动摘要/合并，没有 `archive/`，没有保留期，也没有任何会删除记忆的定时任务：
写入只发生在模型调用 `memory` 工具时，删除只能由模型的 `delete` 或用户在设置页手动发起。索引的 200 行 / 25 KB
是**加载**上限（超出部分不进请求，注入文本与设置页都会说明），不是裁剪；`maxFileBytes` 只拒绝超限的读写。

这是 2026-09-20 与用户确认后的决定（当时摆出「按 description 回忆相关文件」「体检 + 一键整理」「定时归档」三条路，
选择暂不做）。要加其中任何一项先确认；**默认永不静默删除用户记忆**——真要引入归档，也只能移动、必须可配置、默认关闭。

## 部署

```sh
pnpm dsh plugin --profile web add C:/02-codespace/deepseek-harness/dsh-memory   # 本地（symlink，重建即生效）
pnpm dsh plugin --profile web add github:zhang-guo-wen/dsh-memory               # git 源
pnpm dsh --profile web --dump-config | Select-String dsh-memory                  # 确认进了组合
```

`patchReload: live` 的 profile 会在清单变化后热重组；浏览器仍需硬刷新（boot 图是页面加载时组装的）。
client 产物变了还要 bump `HANDOFF_ID` 或强刷。

**host 半边是进程内模块：重建 `lib/index.mjs` 不会替换正在运行的那份代码。** 只有 `dsh plugin add/remove` 造成的
重组才会把它 import 进进程，之后改源码必须**重启宿主**才生效。判断运行中的是哪一版：`dsh --profile web --dump-config`
只反映组合，不反映进程内代码；直接看行为（如 `memoryStore.status` 报的目录、设置页里有没有新字段）更可靠。
client 半边相反：bundle 按内容 rev 提供，刷新页面就会取到新的。

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
9. **消息来源写回通用 `{ kind: 'plugin', plugin }`** → V4 会话直接拒绝该行（"requires a producer-owned source
   kind"），注入的那一步落不进日志。kind 必须是自己声明合并进 `MessageSourceMap` 的那个 `plugin:<包名>#<loader>`。
10. **客户端 inject 的服务名对不上宿主那版 harness** → 整个 client 半边停在 pending（浏览器只显示
   "Failed to load plugins"）。设置页的表单服务在 0.1.7 从 `settingsScope` 改名为 `configForms`：
   `ctx.configForms.get<T>(命名空间)` 返回 `ConfigForm<T>`，读写契约见 `src/client/settings-controller.ts`。

## 安装

`lib/` 是提交进仓库的构建产物（见「目录」「构建」两节），所以从 git 装完即可运行，**机器上不需要构建步骤**。

```sh
# npm 官方源
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-memory

# HTTPS
npx @deepseek-ai/dsh plugin --profile web add https://github.com/zhang-guo-wen/dsh-memory.git

# SSH
npx @deepseek-ai/dsh plugin --profile web add git+ssh://git@github.com/zhang-guo-wen/dsh-memory.git

# 按 tag 固定版本
npx @deepseek-ai/dsh plugin --profile web add "git+ssh://git@github.com/zhang-guo-wen/dsh-memory.git#v0.1.0"

# 本地目录（pnpm 建 symlink，改完源码重建 lib/ 后重启宿主即生效，无需重装）
npx @deepseek-ai/dsh plugin --profile web add /absolute/path/to/dsh-memory

# 卸载：依赖与 layer 一起移除
npx @deepseek-ai/dsh plugin --profile web remove @guowenzhang/dsh-memory
```

装完重启宿主；`patchReload: live` 的热重组与浏览器硬刷新（Ctrl+F5）语义见「部署」一节——浏览器持有上一次的 boot 图，不刷新看不到新的设置区块。

## 组合接线

`cordis.patch.yml` 把插件行插进组合的 bundle 层：

```yaml
- insert:
    - id: memory
      name: '@guowenzhang/dsh-memory'
```

`package.json` 的 `dsh.bundle.patch` 指向这份 patch，`dsh.client.inject` 列全浏览器半边 apply 用到的服务提供包（`@deepseek-ai/dsh-api-gateway`、`@deepseek-ai/dsh-api-remotes`、`@deepseek-ai/dsh-api-workspace-controller`、`@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-renderer`、`@deepseek-ai/dsh-client-ui-settings`、`@deepseek-ai/dsh-client-ui-slots`），`platform` 为 `web`。`exports` 另导出 `./client`（`lib/client.js`）与 `./cordis.patch.yml`。

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

## 测试

spec 在 `tests/`，不属于 harness monorepo 的测试门禁；两条命令都在它旁边的 harness checkout 里运行。

```sh
# 全量（推荐）：用 checkout 的 vitest，经 tsconfig.base.json 的 paths 解析 @deepseek-ai/*
node_modules/.bin/vitest run --root dsh-memory --config vitest.harness.config.ts

# 自足子集：用本包自己的 node_modules，只跑 tests/**/*.spec.ts
node_modules/.bin/vitest run --root dsh-memory
```

全量覆盖 `store.spec.ts` / `settings.spec.ts` / `instructions.spec.ts` / `tool.spec.ts` / `loader-composition.spec.ts` / `memory-section.spec.tsx` / `settings-controller.spec.ts` 七个 spec；自足子集只有前四个——`loader-composition.spec.ts` 需要 checkout 的 Loader 与注册表包，`memory-section.spec.tsx` 需要 React，`settings-controller.spec.ts` 要 `dsh-client-store` 的 Zustand 引擎。逐项覆盖范围见 [tests/README.md](tests/README.md)。
