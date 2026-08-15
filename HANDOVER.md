# 交接文档

本文件是项目进度的唯一 git 管理入口。会话里的 plan 文件不受版本控制；改方向、完成一期、发现新缺口时，**先改这里**。

对照源码：`../deepseek-harness`、`../router-agents`。禁止修改 harness。

## 目标

用 dsh 的 agent loop 当 Leader，在本仓库用**树外插件**重建 PiHuo 的 Worker 层。ACP Worker 只是其中一个插件。

硬约束见下文「边界」。技能见 [AGENTS.md](AGENTS.md)。

## 状态

| 期 | 内容 | 状态 |
|---|---|---|
| 0 | 仓库骨架、组合包、交接文档 | **完成** |
| 1 | 固定 CLI `pihuo-acp` + `acp_worker` 工具卡 | **Host 契约 + client factory 已通；Web 手工验收未做** |
| 2 | 会话池、复用键、`ctx.approval` | 未开始 |
| 3 | Registry + `settings.section` | 未开始 |
| 4 | `leader-persona`、dock、可选 ephemeral 流 | 未开始 |
| 5 | `worker-dispatch`、更多后端 | 未开始 |

## 边界（不要踩）

- 不要 `session.append` **新事件类型**（无法标 `ignorable`，重启后整份会话拒读）。
- 不要用 `settings.plugin.item`、不要指望 `ctx.remote.pihuo*`。
- 不要实现 `prepareContinuable`。
- 不要占用第一方 Provider 名 `acp` 或默认工具名 `subagent`。我们用 `pihuo-acp` / `acp_worker`。
- 导出 API 写完整准确的英文 JSDoc（[comments.md](.agents/skills/dsh-plugin-conventions/references/comments.md)）。
- ACP SDK 用 **1.2.x**，不要用第一方的 0.25.1。
- Chat 卡骑 `tool/call` + `tool/result` + keyed `tool.call.toolview`。
- `dsh.client` 的 `exports["./client"]` 必须是 `__ModuleLoader__` CJS factory（`lib/client.js`），不要拿 tsc ESM 当 served bundle。

## 目录

```text
packages/
  worker-protocol/    纯类型
  worker-runtime/     复用键 / 以后的池
  acp-protocol/       ACP 1.2 Client driver + mock CLI
  acp-worker/         Host：ctx.subagents.registerProvider(pihuo-acp)
  ui-acp-worker/      Client：tool.call.toolview key=acp_worker
  bundle/             @pihuo/dsh-pihuo  唯一 dsh.bundle
```

依赖只能向上：`worker-protocol` → `worker-runtime` → `acp-protocol` → `acp-worker`。

## 本轮（2026-08-16）

- 注释规范写入 `.agents/skills/dsh-plugin-conventions/references/comments.md`。
- pnpm workspace + `@pihuo/dsh-pihuo` 组合包。
- `acp-protocol` 假 ACP 子进程测试通过（handshake / prompt / cancel / permission）。
- `acp-worker` 每次 `start()` 新进程（池留到第 2 期）；dsh 类型用本地 shim，不链 harness 源码。空 `args` 在 `start()` 拒绝，避免裸 `node` REPL。
- `ui-acp-worker` 用 esbuild 打 `__ModuleLoader__` factory（`lib/client.js`），`exports["./client"]` 指向它。
- `development-cdp` 技能 + `scripts/cdp-check.mjs`（Chrome `:9222`）。`pageinfo` 读 `__DSH_BOOT__.entries`，不是不存在的 `.plugins`。
- `scripts/write-dev-patch.mjs` 生成带绝对包根路径的 web overlay，指向 mock ACP。

## 下一步

1. 按 [development-cdp](.agents/skills/development-cdp/SKILL.md) 起 dsh Web + Chrome `:9222`，`node scripts/cdp-check.mjs pageinfo` 确认 `hasUiAcpWorker: true`。
2. 对假 ACP 点一次 `acp_worker`，确认 `[data-acp-worker]` 出现。
3. 第 2 期：把 `worker-runtime` 的复用键接进 `acp-worker.start`。

## 开发

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
node scripts/write-dev-patch.mjs /tmp/dsh-pihuo-web.patch.yml

# npm 安装的 dsh（快，看效果用这条）
npx --yes @deepseek-ai/dsh web --patch /tmp/dsh-pihuo-web.patch.yml

# 或源码检出（要先 pnpm install && pnpm run build）
pnpm --dir ../deepseek-harness dsh web --patch /tmp/dsh-pihuo-web.patch.yml
```

假 ACP：`packages/acp-protocol/bin/mock-acp-agent.mjs`（`MOCK_TEXT` / `MOCK_STOP` / `MOCK_HANG` / `MOCK_PERMISSION`）。

Web 验收（CDP，不是 PiHuo Electron `:8315`）：

```sh
# 终端 2 — Chrome
# --remote-debugging-port=9222 --user-data-dir=/tmp/dsh-pihuo-cdp http://127.0.0.1:3080
node scripts/cdp-check.mjs wait
node scripts/cdp-check.mjs pageinfo
```
