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
dsh plugin --profile web add @pihuo/dsh-pihuo
```

安装后打开设置里的 ACP Worker，从目录添加并信任。新会话选用 PiHuo Leader。

## 发布

推送 `vX.Y.Z` tag 会触发 GitHub Actions，把 `packages/*` 发到 [npmjs](https://www.npmjs.com)。预发布 tag（如 `v0.1.0-rc.1`）走 npm dist-tag `next`，不会盖掉 `latest`。

一次配置：

1. 在 [npmjs.com](https://www.npmjs.com/org/create) 创建公开组织 `pihuo`。
2. 创建 Granular Access Token（Read and write，范围 `@pihuo/*`，允许发布新包）。
3. 仓库 Settings → Secrets and variables → Actions 添加 `NPM_TOKEN`。

```sh
git tag v0.1.0
git push origin v0.1.0
```

CI 会用 tag 覆盖各包 `version` 再 publish，不必先改 `package.json`。

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
