# dsh-pihuo-plugins

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的树外（out-of-tree）插件仓库。插件按 `dsh plugin add` 安装进 profile，不改 harness 源码。

仓库里目前先放跨工具的编写规范与技能；具体插件随后加入。

## 给 Agent

规范的唯一出处是 [`.agents/skills/`](.agents/skills/README.md)。任何 agent 工具先读根目录 [AGENTS.md](AGENTS.md)。

| 任务 | 技能 |
|---|---|
| 写插件 | [dsh-plugin-author](.agents/skills/dsh-plugin-author/SKILL.md) |
| 运行时 / 加载失败 | [dsh-plugin-runtime](.agents/skills/dsh-plugin-runtime/SKILL.md) |
| 安装与发布 | [dsh-plugin-compose](.agents/skills/dsh-plugin-compose/SKILL.md) |
| 命名与扩展点 | [dsh-plugin-conventions](.agents/skills/dsh-plugin-conventions/SKILL.md) |
| 浏览器半 | [dsh-plugin-client](.agents/skills/dsh-plugin-client/SKILL.md) |
| 审查 | [dsh-plugin-review](.agents/skills/dsh-plugin-review/SKILL.md) |

对照源码：旁边的 `deepseek-harness` 检出。与源码冲突时以源码为准。

## 安装（插件就绪后）

```sh
dsh plugin --profile web add github:xun404/dsh-pihuo-plugins
dsh --profile web --dump-config
```

Git 安装需要包自带 `prepare`，并在该 profile 的 `pnpm-workspace.yaml` 里允许 `allowBuilds`。细节见 [compose 技能](.agents/skills/dsh-plugin-compose/SKILL.md)。

发现用 GitHub topic [`dsh-plugin`](https://github.com/topics/dsh-plugin)。
