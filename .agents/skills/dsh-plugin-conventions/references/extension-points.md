# 扩展点

先选事件域，再写代码。完整表以 `../deepseek-harness/docs/architecture.md` 的「新行为的归属位置」为准。

| 目标 | 挂这里 |
|---|---|
| 模型提供方 | `ctx.llm.registerAdapter` |
| 模型可调用能力 | `ctx.tools.register`（schema 进提示词组装） |
| 某会话不同能力集 | agent preset + `isolate` |
| shell / 终端 | `ctx.shell` / `ctx.terminals` 后端，再注册对应 tool |
| 用户斜杠命令 | `ctx.commands`（不经模型轮次） |
| 后台工作 | `ctx.jobs` |
| 文件系统或观察策略 | `ctx.fs` 提供方，或 `fs/*` 事件 |
| 限制所启动进程 | `ctx.sandbox` |
| 拦截请求、工具、轮次 | `agent/*`、`tools/*`；停轮次用 `agent/turn-stopping` |
| 模型可见上下文 | `agent.inject()`，落入下一次获准的请求 |
| 持久会话事实 | 扩展 `SessionEventMap`，从日志渲染 |
| Web Chat 节点 | `ConversationNodeDefinition` + keyed renderer |
| 设置 UI | Client slot `settings.plugins.tab` / `settings.plugin.item`（见 client 技能） |
| 会话标题 | 唯一的 `ctx.sessionTitle` 提供方 |

## 事件域

- **会话事件**：追加到日志，经 `session/event` 广播。重载后仍在 → 用它。
- **Agent 事件**（`agent/*`）：带着活跃 `Agent`。观察或拦截进行中的工作 → 用它。
- **能力事件**（`fs/*`、`tools/*`、`telemetry/*`）：给 seam 附加策略，避免 import 循环。

`turn/*`、`step/*`、`user/message`、`assistant/*`、`tool/*` 是持久会话事件。其余是实时扩展点。

## 不要做的归属

- 不要在 Host 插件里画 React。
- 不要用环境变量代替 Config（临时的 `DSH_TOOLS_MODE` 是第一方 workaround，不要学）。
- 不要把密钥写进 settings 响应或 patch 文件；密钥走 `ctx.credentials`。
- 不要为了设置页改 `packages/host/apiproxy` 白名单——树外插件默认不出现在「插件配置」卡片里。用户改 profile patch 即可。
