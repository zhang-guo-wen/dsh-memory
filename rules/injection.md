# 注入策略与来源 kind 迁移

**何时读我**：改 `src/instructions.ts`、动会话注入时机或消息来源，或排查「注入重复 / 注入没进日志 / 恢复的旧会话认不出」时读本文件。

## 注入时机

注入文本与 `agent/pre-step` 监听在 `src/instructions.ts`：**每个会话折叠一次**，折进第一个带消息的步骤；
来源是本插件自己的 `plugin:@guowenzhang/dsh-memory#memory-index` kind。

## 记忆的三个不变量（第三条）

3. **注入只发生一次，且记进日志。** 消息来源是本插件**自己声明的** kind
   `plugin:@guowenzhang/dsh-memory#memory-index`（`MessageSourceMap` 声明合并）——harness 已经废掉通用的
   `{ kind: 'plugin', plugin }` 包装：V4 会话拒绝它，V3→V4 迁移把旧记录写成 `plugin:<plugin>`，所以声明成同一个
   拼法，恢复的旧会话与新会话才对得上一个身份。`isMemorySource` 仍认旧的包装，只为不重复注入，绝不再写它。
