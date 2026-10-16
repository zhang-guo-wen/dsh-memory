# 易崩清单与历史排查

**何时读我**：改动 host/client 接线、加服务或 Remote 方法、排查「加载失败 / 改动没生效 / 设置页空白」时先读本文件——这些都是实际复发过、或一改就崩的点。

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

## 历史排查记录

- **2026-09-20 决定不做自主维护**：详见 [maintenance.md](maintenance.md)——插件不总结、不归档、不清理，要加先确认。
- **0.1.7 设置页表单服务改名**：`settingsScope` → `configForms`。宿主侧改名后客户端 inject 对不上，整个 client 半边
  停在 pending，浏览器只显示 "Failed to load plugins"；同类命名对不上都按清单第 10 条排查。
- **通用插件来源包装被废弃**：harness 只接受生产者自己声明的 kind，V3→V4 迁移把旧记录写成 `plugin:<plugin>`；
  排查「恢复的旧会话重复注入或注入不落日志」时对照 [injection.md](injection.md) 与清单第 9 条。
