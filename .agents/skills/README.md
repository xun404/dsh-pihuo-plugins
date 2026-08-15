# DeepSeek Harness 插件技能

本目录是技能的**唯一出处**，给所有 agent 工具用（Grok 会扫描 `.agents/skills/`；Claude Code / Cursor / Codex 经仓库根 [AGENTS.md](../../AGENTS.md) 进入）。不要在 `.grok/skills`、`.claude/skills`、`.cursor/skills` 再维护副本。

面向 **树外（out-of-tree）dsh 插件** 的编写、组装、审查。规范以 DeepSeek Harness 源码为准；本机常见对照路径是 `../deepseek-harness`。与源码冲突时以源码为准。

| 技能 | 用途 |
|---|---|
| [`dsh-plugin-author`](dsh-plugin-author/SKILL.md) | 从需求落到可安装插件：选型、脚手架、实现、接线 |
| [`dsh-plugin-runtime`](dsh-plugin-runtime/SKILL.md) | Cordis 运行时：Fiber、inject、事件、effect、HMR |
| [`dsh-plugin-compose`](dsh-plugin-compose/SKILL.md) | Profile / Bundle / patch 层、`dsh plugin`、安装与发布 |
| [`dsh-plugin-conventions`](dsh-plugin-conventions/SKILL.md) | 命名、seam、配置、包布局、扩展点、注释 |
| [`dsh-plugin-client`](dsh-plugin-client/SKILL.md) | 浏览器半：`dsh.client`、slots、设置卡片 |
| [`dsh-plugin-review`](dsh-plugin-review/SKILL.md) | 对照规范审查插件 |
| [`development-cdp`](development-cdp/SKILL.md) | 用 Chrome CDP 调试 dsh Web（`scripts/cdp-check.mjs`） |

事实各有唯一出处。跨技能只引用，不复述。
