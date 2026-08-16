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
| 1 | 固定 CLI `pihuo-acp` + `acp_worker` 工具卡 + 单 Worker 设置页 | **完成**（`settings.section#pihuo-workers` + `GET/PUT /pihuo/workers` + `$DSH_HOME/pihuo/workers.json`） |
| 2 | 会话池、复用键、`permission: ask` → `ctx.approval` | **完成**（进程内池；取消不杀进程；子进程退出标 broken） |
| 3 | Registry + 多行名册 | **完成**（v2 名册 + 官方 Registry **只展示**：CDN `registry.json` → 填 command/args；LKG；捆绑回退；不代装、不 `npx`） |
| 4 | `leader-persona`、dock、可选 ephemeral 流 | **预设 `pihuo-leader` 已装；dock / ephemeral 未开始** |
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
  worker-runtime/     复用键 + 进程内会话池
  acp-protocol/       ACP 1.2 Client driver + mock CLI
  acp-worker/         Host：ctx.subagents.registerProvider(pihuo-acp)
  ui-acp-worker/      Client：tool.call.toolview key=acp_worker
  presets/            把 pihuo-leader 拷进 $DSH_HOME/.agent-presets
  bundle/             @pihuo/dsh-pihuo  唯一 dsh.bundle
```

依赖只能向上：`worker-protocol` → `worker-runtime` → `acp-protocol` → `acp-worker`。

## 本轮（2026-08-16）

- 注释规范写入 `.agents/skills/dsh-plugin-conventions/references/comments.md`。
- pnpm workspace + `@pihuo/dsh-pihuo` 组合包。
- `acp-protocol` 假 ACP 子进程测试通过（handshake / prompt / cancel / permission / ask 回调）。
- `worker-protocol`：`WorkerUserConfig` + `workers.json` 编解码。无密钥字段。停用时允许 inert `node` + 空 `args`。
- `worker-runtime`：进程内池。复用键 `parentSessionId × workerId × revision × cwd × fingerprint`。同键串行；满池 LRU 拆 idle，否则 `PoolFullError`。
- `acp-worker`：`start()` 走池；`GET/PUT /pihuo/workers`（无 `webServer` 则只读文件）；`permission: ask` 调 `ctx.approval.request`（无服务则 cancel）。`session/disposed` 清该 Leader 的池条目。
- `ui-acp-worker`：从目录添加：已添加卡片灰掉禁点；npx/uvx 只认 `$DSH_HOME/pihuo/agents/<id>`（PATH 同名不算已装）。未装弹「未检查到 {name} ACP，需要先安装。」装完才进设置；目录 id/命令/参数只读。
- 三期：v2 名册、`trusted`、PATH probe、`workerId:` 路由。
- 官方 Registry 只展示层：Host `GET /pihuo/catalog` 拉 `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`，按平台 binary 基名 → `npx -y pkg` → `uvx` 投影；成功写 `$DSH_HOME/pihuo/registry-lkg.json`；失败用 LKG；再失败用捆绑 OpenCode / 自定义。设置页展示来源、版本、发行方式。不下载 archive，不代跑 `npx`。
- `pihuo-leader` 预设仍是装 `acp_worker` 的唯一入口。官方 launcher 会盖掉额外 `roots`，预设继续拷进 `$DSH_HOME/.agent-presets`。

## 三期（名册 + 捆绑目录）

- 文件 `version: 2`，`workers: [{ id, title, trusted, ...一期字段 }]`。读 v1 升成一行 `default` 且 `trusted: true`（保持已有会话能跑）。
- 设置页仍是 `settings.section#pihuo-workers`：列表 → 从目录添加 → 编辑行。不进官方「插件配置」。
- 目录默认是官方 ACP Registry 投影（OpenCode / Claude / Gemini / … + 捆绑「自定义」）。**只填 command/args，不下载、不代跑 `npx`。** 勾选 Trusted 后启动才会执行该命令。
- `trusted === false` 的行不会 spawn。PATH 探测（`POST /pihuo/workers/probe`）只 `access` 可执行文件。
- 多个已启用且已信任的 Worker：prompt 首行 `workerId: <id>`。系统提示里列出就绪行。

## 下一步

1. 设置页加一行 OpenCode（若本机有 `opencode`），勾选已信任，用 `workerId: opencode` 委派一次。
2. 第 4 期：dock / ephemeral 活动流（仍禁止新 session 事件类型）。
3. 用户点目录里的安装按钮才会装到 `$DSH_HOME/pihuo/agents/<id>`。PATH 上的同名 CLI 不算已装。

## 远端 ACP Registry

客户端 API 是 CDN `registry.json`，不是 git clone `github.com/agentclientprotocol/registry`。

| 层 | 状态 |
|---|---|
| A. 只展示 | **完成**。`loadOfficialCatalog`：live 8s → 写 LKG → LKG → 捆绑。投影不执行、不下载。 |
| B. 发布期 sync 打进包 / digest | 未做（运行时 LKG 已够离线一次）。 |
| C. 代装 CLI | **不做**。和 fail-closed trust / 不代下包冲突。 |

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
