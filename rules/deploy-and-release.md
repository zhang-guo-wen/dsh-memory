# 部署、安装与发版

**何时读我**：要装/卸本插件、改完源码判断「怎么才算生效」，或准备发版、打 tag、写安装文档时读本文件。

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
npx @deepseek-ai/dsh plugin --profile web add "git+ssh://git@github.com/zhang-guo-wen/dsh-memory.git#v1.0.0"

# 本地目录（pnpm 建 symlink，改完源码重建 lib/ 后重启宿主即生效，无需重装）
npx @deepseek-ai/dsh plugin --profile web add /absolute/path/to/dsh-memory

# 卸载：依赖与 layer 一起移除
npx @deepseek-ai/dsh plugin --profile web remove @guowenzhang/dsh-memory
```

装完重启宿主；`patchReload: live` 的热重组与浏览器硬刷新（Ctrl+F5）语义见「部署」一节——浏览器持有上一次的 boot 图，不刷新看不到新的设置区块。

## 发版

`lib/` 提交进仓库，所以**发版 = 改版本号 + 构建 + 提交产物 + 打 tag**。

1. 改根 `package.json` 的 `version`。
2. `npm run build`，确认 `lib/index.mjs` 与 `lib/client.js` 是最新的。
3. 提交源码与 `lib/`。
4. `git tag -a v<version> -m "dsh-memory <version>"` 并 `git push dsh-memory master --follow-tags`。

用户没有明确要求时**不得**自行发版、递增版本号或打 tag。
