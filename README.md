# dsh-pihuo-plugins

[English](README_en.md)

DeepSeek Harness 插件。把本机 ACP 进程接到会话里当 Worker。

## 能力

- 从官方 ACP 目录添加 Worker，本机未装时可先安装再保存
- 启用、信任、模型和思考都走现场 ACP 探测
- PiHuo Leader 只调度，不使用本机会话的文件或 Shell
- 每个对话可组建团队：给已注册 Worker 分配角色、模型和思考
- Leader 调用 `acp_worker` 会自动入座
- 执行卡片按真实时间线展示思考、工具和答复

## 安装

```sh
dsh plugin --profile web add github:xun404/dsh-pihuo-plugins#path:packages/bundle
```

安装后打开设置里的 ACP Worker，从目录添加并信任。新会话选用 PiHuo Leader。

## 本地开发

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
node scripts/write-dev-patch.mjs /tmp/dsh-pihuo-web.patch.yml
npx --yes @deepseek-ai/dsh web --patch /tmp/dsh-pihuo-web.patch.yml
```

浏览器打开 http://127.0.0.1:3080/
