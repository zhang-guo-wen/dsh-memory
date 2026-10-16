# 插件契约（Cordis）与 Typert Remote

**何时读我**：动 host 插件导出的形状、加依赖服务、改设置页 RPC（新增/修改 Remote 方法）时读本文件——这里的每条都对应一个「漏了就崩」的接线点。

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
