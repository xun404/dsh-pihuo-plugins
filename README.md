# PiHuo

[English](README_en.md) | 中文

PiHuo 是一组 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）**树外插件**。它把本机 [ACP](https://agentclientprotocol.com) 进程接到会话里当 Worker，由 Leader 调度。

架构上 **一切皆插件**，运行在 [Cordis](https://github.com/cordiverse/cordis) 上，不改 harness 源码。

## 开发者预览

目前处于开发者预览，跟随 `dsh` 快速迭代。**未来可能出现破坏兼容性的变更。**

## 安装

需要 [Node.js](https://nodejs.org/) 22+，以及已安装的 DeepSeek Harness。

### 通过 `npm`

```sh
dsh plugin --profile web add @pihuo/dsh-pihuo
dsh web
```

Web UI 默认在 `http://127.0.0.1:3080/`。

打开设置里的 **ACP Worker**，从官方目录添加 Worker 并勾选信任。新会话选用 **PiHuo Leader**。

预发布（npm dist-tag `next`）：

```sh
dsh plugin --profile web add @pihuo/dsh-pihuo@next
```

组合包：[`@pihuo/dsh-pihuo`](https://www.npmjs.com/package/@pihuo/dsh-pihuo)。

### 从源码

```sh
git clone https://github.com/xun404/dsh-pihuo-plugins.git
cd dsh-pihuo-plugins
pnpm install
pnpm test
pnpm typecheck
pnpm build
node scripts/write-dev-patch.mjs /tmp/dsh-pihuo-web.patch.yml
npx --yes @deepseek-ai/dsh web --patch /tmp/dsh-pihuo-web.patch.yml
```

浏览器打开 `http://127.0.0.1:3080/`。

## 能力

- 从官方 ACP 目录添加 Worker；本机未装时可先安装再保存
- 启用、信任、模型和思考都走现场 ACP 探测
- PiHuo Leader 只调度，不使用本机会话的文件或 Shell
- 每个对话可组建团队：给已注册 Worker 分配角色、模型和思考
- Leader 调用 `acp_worker` 会自动入座
- 执行卡片按到达顺序展示思考、工具和答复

## 社区与支持

- 问题与反馈走 [GitHub Issues](https://github.com/xun404/dsh-pihuo-plugins/issues)
- 本仓库已添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic，便于在插件目录里被发现
- DeepSeek Harness：[仓库](https://github.com/deepseek-ai/deepseek-harness) · [Discord](https://discord.gg/Ycq5dCaS4)

## 开发

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。进度以 [HANDOVER.md](HANDOVER.md) 为准。

推送 `vX.Y.Z` tag 会把 `packages/*` 发到 npmjs。预发布 tag（如 `v0.1.0-rc.1`）走 dist-tag `next`。

## 许可证

[MIT](LICENSE)
