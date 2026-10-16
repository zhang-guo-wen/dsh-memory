---
paths:
  - "package.json"
  - "build-client.mjs"
  - "tsdown.config.ts"
  - "vitest.config.ts"
  - "vitest.harness.config.ts"
  - "tsconfig.json"
  - "tests/**"
---

> 覆盖什么、何时读：改构建配置、升级 harness 版本、排查产物异常，或要跑测试并判断该跑哪条命令时读本文件。逐 spec 覆盖范围见 [tests/README.md](../../tests/README.md)。

# 构建与测试

## 构建

```sh
npm install
npm run typecheck   # tsc --noEmit -p tsconfig.json
npm run build       # tsdown（host） + node build-client.mjs（client）
```

- host：`tsdown` 打 `src/index.ts` → `lib/index.mjs`，所有 `@deepseek-ai/*` 保持 external。
- client：`build-client.mjs`（rolldown）→ `lib/client.js`，包成 `window.__ModuleLoader__.load({ id, factory })`，
  react / `@deepseek-ai/*` external，`.module.css` 用 lightningcss 编译并内联。
- `peerDependencies` 与 `devDependencies` 里的 `@deepseek-ai/dsh-*` 统一声明 `>=0.1.7-0`，`engines.dsh` 写同一个口径：
  这些包既是编译时的接口面，也是运行时要与宿主共享实例的那一份，`*` 等于没声明。`@deepseek-ai/cordis`（`^4.0.4`）与
  `@deepseek-ai/schemastery`（`^3.18.2`）各自有独立的版本线，不跟这条走。升 harness 时联动改这里，再跑
  `npm run typecheck` 与全量 spec。

**Node 不解析 TC39 装饰器。** tsdown 默认不降级装饰器，所以 `tsdown.config.ts` 里有一个
`lowerDecorators` transform（用 `typescript` 的 `transpileModule`）。少了它，`MemoryRemote` 上的 `@Remote`
会以原始语法留在 `lib/index.mjs`，host 加载即崩。

## 测试

spec 在 `tests/`，不属于 harness monorepo 的测试门禁；两条命令都在它旁边的 harness checkout 里运行。

```sh
# 全量（推荐）：用 checkout 的 vitest，经 tsconfig.base.json 的 paths 解析 @deepseek-ai/*
node_modules/.bin/vitest run --root dsh-memory --config vitest.harness.config.ts

# 自足子集：用本包自己的 node_modules，只跑 tests/**/*.spec.ts
node_modules/.bin/vitest run --root dsh-memory
```

全量覆盖 `store.spec.ts` / `settings.spec.ts` / `instructions.spec.ts` / `tool.spec.ts` / `loader-composition.spec.ts` / `memory-section.spec.tsx` / `settings-controller.spec.ts` 七个 spec；自足子集只有前四个——`loader-composition.spec.ts` 需要 checkout 的 Loader 与注册表包，`memory-section.spec.tsx` 需要 React，`settings-controller.spec.ts` 要 `dsh-client-store` 的 Zustand 引擎。逐项覆盖范围见 [tests/README.md](../../tests/README.md)。
