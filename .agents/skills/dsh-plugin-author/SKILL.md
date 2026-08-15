---
name: dsh-plugin-author
description: >
  Scaffold and implement DeepSeek Harness (dsh) out-of-tree plugins — tools,
  services, adapters, hooks, bundles. Use when writing a new plugin, adding a
  model tool, creating apply()/inject/Config, scaffolding a dsh.bundle package,
  or the user says /dsh-plugin-author, "写插件", "做个插件", "scaffold plugin",
  "加一个工具".
metadata:
  short-description: Write a dsh plugin
argument-hint: "[tool|service|adapter|hook|ui] <name>"
---

# 编写 dsh 插件

本技能是开发流程。运行时细节读 [dsh-plugin-runtime](../dsh-plugin-runtime/SKILL.md)；层与安装读 [dsh-plugin-compose](../dsh-plugin-compose/SKILL.md)；命名与 seam 读 [dsh-plugin-conventions](../dsh-plugin-conventions/SKILL.md)；浏览器半读 [dsh-plugin-client](../dsh-plugin-client/SKILL.md)。模板只在 [references/templates.md](references/templates.md)。

规范对照仓库：`../deepseek-harness`（若存在）。与源码冲突时以源码为准。

## 1. 分类，再动手

按用户目标选一种，且只选一种作为主交付。对照 [conventions 的扩展点表](../dsh-plugin-conventions/references/extension-points.md)：

| 用户要的 | 形态 | 必读 |
|---|---|---|
| 模型可调用的能力 | 工具插件：`inject: ['tools']` + `defineTool` | 本技能 §3 + [templates §工具](references/templates.md#工具插件) |
| 可替换的底层能力 | seam 三角（Definition / Provider / Consumer） | [seams](../dsh-plugin-conventions/references/seams.md) |
| 新模型提供方 | `ctx.llm.registerAdapter` | [templates §适配器](references/templates.md#llm-适配器) |
| 拦截 / 策略 | 事件钩子（优先 `tools/*`、`agent/*`） | [templates §钩子](references/templates.md#钩子插件) |
| Web UI / 设置卡片 / Chat 节点 | 浏览器半 | [dsh-plugin-client](../dsh-plugin-client/SKILL.md) |
| 把已有模块装进 profile | 组合包（`dsh.bundle` + patch） | [dsh-plugin-compose](../dsh-plugin-compose/SKILL.md) |

不要为「以后可能扩展」先拆三角。一个包能诚实承担的职责就放一个包。

## 2. 落盘位置

本仓库是树外插件集，**不要**往 `../deepseek-harness/packages/` 加第一方包，除非用户明确要求改 harness。

默认骨架：

```text
<pkg>/
  package.json          # name、exports、dsh.bundle
  cordis.patch.yml      # insert 本包行
  src/index.ts          # name / inject / Config / apply
  tsconfig.json
  README.md
```

- 包名：`dsh-<name>` 或 `@<scope>/dsh-<name>`。不要用 `@deepseek-ai/`。
- 插件 `export const name` 用短横线 id，与 patch `id` 对齐（见 conventions）。
- TypeScript 插件必须有自包含 `prepare` 构建，git 安装才能用。步骤见 compose。

先列出将要创建的文件，再写。不要先写实现再补 manifest。

## 3. 实现顺序

1. 写 `package.json` 与 `cordis.patch.yml`（[compose 清单](../dsh-plugin-compose/references/publish.md)）。
2. 导出 `name`、`inject`、可选 `Config`（Schemastery，不是普通对象）、`apply`。三种形态见 [runtime](../dsh-plugin-runtime/SKILL.md)；默认用函数形态。只有要提供 `ctx.<key>` 时才用 `Service` 子类。
3. `inject` 列出 `apply` 会读取的服务。可选服务用 `ctx.get('x')`，不要写进 `inject`。
4. 所有注册走 `ctx`（`register` / `on` / `effect`）。禁止模块顶层副作用。禁止自己 `removeListener` / `clearInterval` 来「对应」`ctx.on` / `ctx.effect`。
5. 部署可能不同的值放进 `Config`。硬编码超时、路径、模型名是错的。
6. 需要清理的外部资源包进一个 `ctx.effect(() => disposer)`。有顺序依赖的清理放进**同一个** disposer。

工具插件额外遵守 [templates 的 execute 契约](references/templates.md#execute-契约)。不要把政策写进 `execute`：允许/拒绝走 `tools/pre-execute` 或 `ctx.tools.guard()`。

## 4. 接线与验证

开发期（未打成组合包）：

```yaml
# scratch cordis.yml
# Host-only 可以指绝对 src/index.ts。
# dsh.client 包必须用包名（与 client factory id 一致），见 compose / client。
- insert:
    - id: <plugin-id>
      name: '@scope/dsh-example'
      config: {}
```

```sh
dsh web --patch ./<pkg>/cordis.yml
# 或源码检出：
pnpm --dir ../deepseek-harness dsh web --patch /absolute/path/to/<pkg>/cordis.yml
```

组合包安装与 `--dump-config` 见 compose。改完后：

- 配置层能在 dump 里看到本包的 `# == <package>` 段。
- 工具：用一句会触发该工具的用户话验证模型能调用。
- 服务：依赖方在提供方未挂载时保持 `PENDING`，挂上后变 `ACTIVE`。
- 有 UI 的改动按 [dsh-plugin-client](../dsh-plugin-client/SKILL.md) 验证。

## 5. 交付

- 不要改 harness 内置 bundle，除非用户要的是第一方补丁。
- 用户要「能分享 / 能 `dsh plugin add`」时，走 compose 的发布路径，不要只留 `--patch`。
- 实现完成后用 [dsh-plugin-review](../dsh-plugin-review/SKILL.md) 过一遍清单。
