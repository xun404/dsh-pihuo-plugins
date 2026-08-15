---
name: dsh-plugin-compose
description: >
  Compose, install, and publish DeepSeek Harness plugin bundles — profile
  layers, cordis.patch.yml, dsh plugin add, --patch overlays, dump-config.
  Use when installing a plugin, writing a bundle patch, publishing to a
  profile, debugging layer order, or the user says /dsh-plugin-compose,
  "安装插件", "dsh plugin add", "cordis.patch", "发布组合包", "--dump-config".
metadata:
  short-description: Install and compose dsh plugins
argument-hint: "[add|remove|dump|publish] [profile] [package]"
---

# 组装、安装、发布

运行中的 `dsh` 是一棵由多层 patch 叠出来的插件树。本技能拥有层顺序、patch 语义、profile/bundle manifest、安装命令。插件源码怎么写见 [dsh-plugin-author](../dsh-plugin-author/SKILL.md)。

对照：`../deepseek-harness/packages/boot/app-boot`、`vendor/include`、`apps/cli/src/plugin.ts`。

细节：[references/layers.md](references/layers.md)、[references/publish.md](references/publish.md)。

## 两个概念

| | 组合包 bundle | Profile |
|---|---|---|
| 回答 | 这个包贡献什么 | 按什么顺序叠哪些包 |
| 位置 | 任意 npm/git/path 包 | `$DSH_HOME/profiles/<name>/` |
| manifest | `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` | `"dsh": { "profile": { "bundles": [...] } }` |
| 谁维护 | 插件作者 | `dsh plugin`（不要手改 bundles 除非排障） |

没有东西同时是两者。没有 `dsh.bundle` 的包仍可安装，只当普通依赖，不进层栈。

内置模板：`web` = `dsh-base` + `dsh-web-app`；`headless` = `dsh-base` + `dsh-headless`。自定义 profile 默认从 `dsh-base` 起。

## 层顺序（后写的按行胜出）

1. `dsh.profile.bundles` 里每个组合包的 patch，按列表顺序
2. profile 的 `cordis.patch.yml`
3. `$DSH_HOME/cordis.patch.yml`
4. 每个 `--patch` overlay，按 argv 顺序

应用参数不是一层 patch。覆盖按 **id 整行替换 `config`**，不是深合并。覆盖必须重述该行每一个键。

模块解析：先 dsh 安装目录，再 profile `node_modules`，再 `$DSH_HOME/profiles/node_modules`（启动时 heal 的扁平 symlink）。内置包永远跟当前安装走。树外插件必须把 `@deepseek-ai/cordis` 和所用服务定义做成 **peer**，以便落到同一份安装实例。

## 日常命令

```sh
dsh plugin --profile <name> add <spec>      # 转发 pnpm；相对路径按调用目录锚定
dsh plugin --profile <name> remove <pkg>
dsh --profile <name> --dump-config          # 必须能看到 "# == <pkg>"
dsh --profile <name>
dsh web --patch ./overlay.yml               # 开发 overlay，不改 profile
```

`add` 成功后按**已安装状态**对账：有 `dsh.bundle` 的依赖追加进 `bundles`；去掉或不再声明 bundle 的依赖从层栈移除。模板内置包不是依赖，不会被 remove 逻辑碰到。

## 写 patch 时

- 新插件：根级 `insert`，自带稳定 `id`。
- 改已有行：`- id: <existing>` + 完整 `config`。`name` 若写了必须与目标一致，否则跳过并 warn。
- `insert` 进某个 group：带上那个 group 的 `id`。
- 同层后一条可以改前一条刚 insert 的行。
- 匹配不到的 patch 被跳过，不失败启动——所以 dump 是验收，不是可选项。

## 发布检查

按 [publish.md](references/publish.md) 的作者清单做完再让用户 `add`。Git 安装必须有自包含 `prepare`，用户还要在该 profile 的 `pnpm-workspace.yaml` 里 `allowBuilds`。能发 npm / tarball 就不要逼用户授权 prepare。
