# AGENTS.md

本仓库编写 **DeepSeek Harness 树外插件**。任何 agent 工具（Grok、Claude Code、Cursor、Codex 等）都读这份文件。

## 技能在哪

规范与流程的唯一出处是 [`.agents/skills/`](.agents/skills/README.md)，不要写进 `.grok/`、`.claude/skills/`、`.cursor/skills/` 再维护一份。

动手前按任务读对应 `SKILL.md`（含它指向的 `references/`）：

| 任务 | 读这个 |
|---|---|
| 写 / 脚手架 / 实现插件 | [dsh-plugin-author](.agents/skills/dsh-plugin-author/SKILL.md) |
| Fiber / inject / 加载失败 / 事件 / HMR | [dsh-plugin-runtime](.agents/skills/dsh-plugin-runtime/SKILL.md) |
| 安装、发布、`cordis.patch.yml`、`dsh plugin add` | [dsh-plugin-compose](.agents/skills/dsh-plugin-compose/SKILL.md) |
| 命名、seam、扩展点、包怎么拆 | [dsh-plugin-conventions](.agents/skills/dsh-plugin-conventions/SKILL.md) |
| 浏览器半、slots、设置 UI | [dsh-plugin-client](.agents/skills/dsh-plugin-client/SKILL.md) |
| 审查已有插件 | [dsh-plugin-review](.agents/skills/dsh-plugin-review/SKILL.md) |

## 对照源码

规范以 DeepSeek Harness 源码为准。本机常见路径：`../deepseek-harness`。与技能或本文冲突时以源码为准。

## 站立约束

- 不要往 harness 的 `packages/` 加第一方包，除非用户明确要求改 harness。
- 不要在本仓库复制技能到各厂商目录。某个工具只扫描自己的 skills 目录时，对该目录做**指向** `.agents/skills` 的符号链接，不要拷贝。
