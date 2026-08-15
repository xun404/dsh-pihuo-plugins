---
name: dsh-plugin-conventions
description: >
  DeepSeek Harness plugin conventions — capability seams, naming, Config
  schema, package layout, ctx keys, extension-point choice. Use when deciding
  plugin structure, naming a service, splitting definition/provider/consumer,
  choosing where to hang new behavior, writing or reviewing comments, or the
  user says /dsh-plugin-conventions, "插件规范", "该拆几个包", "挂在哪个扩展点",
  "注释规范".
metadata:
  short-description: dsh plugin conventions
---

# 插件规范

本技能是规范与选型。实现步骤见 [dsh-plugin-author](../dsh-plugin-author/SKILL.md)，审查清单见 [dsh-plugin-review](../dsh-plugin-review/SKILL.md)。

对照：`../deepseek-harness/docs/architecture.md`、`docs/capability-seams.md`、`docs/cookbook/adding-a-package.md`。

展开：[references/seams.md](references/seams.md)、[references/package.md](references/package.md)、[references/extension-points.md](references/extension-points.md)、[references/comments.md](references/comments.md)。

## 硬规则

1. **没有内核可打补丁。** 新行为挂到已有扩展点（服务 / 事件 / slot）。不要 fork agent loop，除非用户明确要换驱动器。
2. **注册必须可逆。** 模块顶层禁止副作用。卸载后不得残留监听、定时器、工具、适配器。
3. **模型可见即已记录。** 任何进入模型请求的新输入都要能从会话日志重建。不要用只有内存里才有的旁路去「喂」模型。
4. **可调参数进 Config。** 检验：能否只改 `cordis.yml` 而不改代码？配置错误必须在加载时失败，不要运行期静默改写。
5. **政策与机制分离。** 工具的 `execute` 做能力；允许/拒绝/超时走 `tools/*` 事件或独立 policy 插件。
6. **Consumer 不依赖 Provider。** 双方只依赖 Service Definition。见 seams。
7. **一个 Context key 一种合同。** 单数 key = 一台引擎/当前配置；复数 key = 注册表。Host 与 Client 禁止用同一 key 表达不兼容类型。
8. **树外包不要冒充第一方。** 包名不用 `@deepseek-ai/`。不要改 `dsh-base` / `dsh-web-app` 来「顺便」带上自己。
9. **动态包不是产品交付。** `cordis_define` / `cordis_run` 只活在内存，重启即空，vm 不是安全边界。可安装功能做成普通组合包。
10. **注释必须完整、准确、可单独维护。** 导出符号、非显然约束、协议/生命周期边界都要有 JSDoc；注释与代码不一致是错误。细则见 [comments.md](references/comments.md)。

## 选型口诀

- 只要换实现、接口稳定 → 拆 Definition / Provider，Consumer 继续 inject 接口。
- 只要给模型新能力 → 注册工具，schema 自动进提示词。
- 只要换一次请求里模型看见的东西 → `agent/pre-step` 或 `agent.inject()`，并保证可从日志重建。
- 只要按会话不同能力 → agent preset + `isolate`，不要在工具里读「当前是谁」硬分叉。
- 只要 Web 上多一块 UI → [dsh-plugin-client](../dsh-plugin-client/SKILL.md)，不要在 Host 插件里 `import 'react'`。

## 命名

| 东西 | 规则 |
|---|---|
| npm 包 | `dsh-<name>` 或 `@<scope>/dsh-<name>` |
| patch / `export const name` | 短横线，稳定，与包的主职责一致 |
| `ctx` key | camelCase；注册表用复数 |
| 工具 `name` | snake_case，模型直接看到 |
| 事件 | `domain/action`，与现有 `agent/*`、`tools/*`、`session/*` 对齐 |

角色词（Controller / Store / Registry / Provider / Policy …）的选用表在 [package.md](references/package.md)。不要因为类 `extends Service` 就把类名做成 `FooService` 却承担注册表职责。

## 本仓库布局

每个可安装插件一个顶层目录（或 `packages/<name>`，一旦开了 workspace 就统一）。目录内自包含：manifest、patch、源码、README。共享工具库如果不是 bundle，就不要声明 `dsh.bundle`。
