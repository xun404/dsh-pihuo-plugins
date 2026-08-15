---
name: dsh-plugin-review
description: >
  Review a DeepSeek Harness plugin against this repo's authoring conventions —
  apply/inject/Config, seams, patch layers, client-slot rules, reversibility.
  Use when reviewing a plugin, auditing a bundle, or the user says
  /dsh-plugin-review, "审查插件", "看看这个插件合不合规范", "review this plugin".
metadata:
  short-description: Review a dsh plugin
---

# 审查 dsh 插件

只报告违反本仓库技能的问题。规则正文在对应技能，这里不下第二份定义。先读改动与插件根目录的 `package.json`、`cordis.patch.yml`、入口模块。

对照源码：`../deepseek-harness`（若存在）。

## 流程

1. 判定形态：工具 / 服务 / 适配器 / 钩子 / Client / 纯 bundle。选错形态本身就是 finding。
2. 按下面清单逐项核对，每条 finding 写：位置、违反的规则（链到技能）、怎么改。
3. 区分错误（必须改）与建议（规范倾向）。
4. 不要评审 harness 第一方风格差异（i18n yaml、invariant 文件等），除非树外包也声明要跟第一方门禁。

## 清单

### 形态与归属 — [conventions](../dsh-plugin-conventions/SKILL.md)

- [ ] 新行为挂在已有扩展点，没有改 agent loop / 没有旁路喂模型。
- [ ] 模型可见输入能从会话日志重建。
- [ ] 该拆 seam 时 Provider 与 Consumer 不互相依赖。
- [ ] 包名、ctx key、工具名、事件名符合命名表。
- [ ] 没有把产品功能做成 `cordis_define` 动态包。
- [ ] 导出符号与非显然边界有准确 JSDoc；没有过时或复述式注释（[comments](../dsh-plugin-conventions/references/comments.md)）。

### 运行时 — [runtime](../dsh-plugin-runtime/SKILL.md)

- [ ] 入口是函数 / `{ apply }` / `Service` 之一；有 `name`。
- [ ] `inject` 覆盖 `apply` 里读的必需服务；可选的用 `ctx.get`。
- [ ] 无模块顶层副作用。
- [ ] 外部资源在 `ctx.effect`；有序清理在同一个 disposer。
- [ ] Waterfall 观察者调用 `next()`；政策插件的短路是故意的。
- [ ] `Config` 是 Schemastery（Standard Schema），不是普通对象。
- [ ] 可调超时/路径/开关在 Config 里，能在 patch 改掉。

### 工具（若有）— [templates](../dsh-plugin-author/references/templates.md)

- [ ] `defineTool`：规范值 + `output.render`；`execute` 尊重 `exec.signal`。
- [ ] 政策不在 `execute` 里。
- [ ] `presentCall` / `presentResult` 若存在则是纯函数。

### 组装 — [compose](../dsh-plugin-compose/SKILL.md)

- [ ] 有 `dsh.bundle.patch`，且 patch 在 `files` 里。
- [ ] patch `id` 稳定；`name` 是包名（不是作者机器路径）。
- [ ] 覆盖已有行时重述完整 `config`。
- [ ] cordis 与所用 Definition 在 `peerDependencies`。
- [ ] TypeScript 包有自包含 `prepare`，或只发预构建产物。

### 浏览器半（若有）— [client](../dsh-plugin-client/SKILL.md)

- [ ] 声明 `dsh.client` + `exports["./client"]`，且 Host 行会挂上该包。
- [ ] `./client` 是 `__ModuleLoader__.load` CJS factory，id 等于包名；`react` external。
- [ ] 只通过 `slots.register` 组合；组件不碰 `ctx`。
- [ ] `./client` 没有多余值导出，没有跨插件 import 组件。
- [ ] 没有假设自己会出现在内置设置白名单里。

## 输出格式

```markdown
## 结论
<一句话：可以合并 / 先改错误>

## 错误
- `path:line` — <规则链接> — <改法>

## 建议
- ...

## 已核对且通过
- <短列表>
```
