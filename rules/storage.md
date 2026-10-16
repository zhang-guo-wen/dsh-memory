# 存储格式、命令契约与路径边界

**何时读我**：改 `src/store.ts` / `src/paths.ts`，或排查写入失败、索引加载不全、路径越界、容量上限时读本文件。六个命令的逐条行为与必填字段见 [`docs/implementation.zh.md`](../docs/implementation.zh.md) 的「使用」章。

## 存储格式

Claude 把记忆放在一个目录里：索引文件 `MEMORY.md` 加每个记忆一个话题文件，用 `memory` 工具的六个命令、
以 `/memories` 寻址读写。本包把这套存储挂到操作者选定的目录上，默认 `~/.dsh/memory/{project}`（每项目一份）；
`claudeCompatible` 打开后改用 Claude Code 自己的 `<Claude 配置目录>/projects/<项目>/memory`。

- 命令面：`view` / `create` / `str_replace` / `insert` / `delete` / `rename`，返回文案、参数与逐条行为见上面的实现参考。
- 索引读取上限、目录列举、软链接越界检查都在 `src/store.ts`。
- 索引的 200 行 / 25 KB 是**加载**上限（超出部分不进请求，注入文本与设置页都会说明），不是裁剪；`maxFileBytes` 只拒绝超限的读写。

## 记忆的三个不变量（前两条）

原文「记忆的三个不变量」中的前两条在这里，第三条（注入只发生一次，且记进日志）见 [injection.md](injection.md)。

1. **返回文案就是契约。** 六个命令的成功与失败都返回 Claude memory 工具的原文（含 `Error: ` 前缀的那些），
   不抛异常——模型是按文案决策的。基础设施故障（盘满、权限）才抛。
2. **路径不越界。** 所有模型给的路径都过 `resolveMemoryPath`（拒 `..`、绝对路径、盘符），再用目录的 realpath
   检查最近存在的祖先，防止目录内软链接把写入引到外面。
