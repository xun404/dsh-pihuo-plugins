---
name: dsh-plugin-client
description: >
  DeepSeek Harness browser-half plugins — dsh.client, client-modules, slots,
  settings cards, Conversation Nodes. Use when adding Web UI, slots.register,
  a settings tab, a chat node, or the user says /dsh-plugin-client, "浏览器插件",
  "写 UI 插件", "slot", "设置页卡片".
metadata:
  short-description: Write dsh browser plugins
---

# 浏览器半插件

Host 插件与浏览器插件共用 Loader 语义（Fiber、inject、update），只换模块如何到达。本技能拥有 `dsh.client`、slots、组件纪律。Host 侧实现仍走 [dsh-plugin-author](../dsh-plugin-author/SKILL.md)。

对照：`../deepseek-harness/packages/client/AGENTS.md`、`packages/client/modules`。

展开：[references/slots.md](references/slots.md)。

## 何时需要浏览器半

| 目标 | 要不要 Client 包 |
|---|---|
| 工具 / 适配器 / 钩子 | 不要。Host 即可 |
| 工具结果的卡片 | 通常只要 Host 上的 `presentCall` / `presentResult`；第一方 UI 会映射 card kind |
| 设置页里自己的表单 | 要。且树外插件默认**不会**出现在内置「插件配置」白名单里 |
| Chat 里一种新节点 | 要。`ConversationNodeDefinition` + `conversation.chat.node` |
| 独立面板 / 设置分区 | 要。往已有 slot 注册 |

先问：能否用 render-intent / 会话事件完成？能就不要开 Client 包。

## 声明

`package.json`：

```json
{
  "exports": {
    ".": { "default": "./lib/index.js" },
    "./client": { "default": "./lib/client.js" }
  },
  "dsh": {
    "client": { "platform": "web", "inject": ["slots"], "immediately": false }
  }
}
```

- 必须同时是 Loader 树上的一条 Host 行（bundle patch insert 包名），`client-modules` 才扫得到。
- `exports["./client"]` 必须指向**构建后**的 bundle。缺文件时启动会聚合成构建说明错误。
- `immediately: true` 仅给外壳级包。功能插件默认懒加载。
- `dsh.client.inject` 是 Cordis 服务依赖，与模块 `export const inject` 一起用。

扫描按包名缓存且不过期：改「是不是 client 包」要重启 dsh。改 bundle 内容走 rebuild 通知，不是改 package.json 字段。

## 实现纪律

1. UI 只通过 `ctx.slots.register({ name, children?, store?, inject? }, Component)` 组合。不要另搞 slot 定义 API。
2. `children` 的 key 就是该组件允许渲染的子 slot。渲染未声明的、或抢注别人声明的，加载失败。
3. 组件看不到 `ctx`。数据只走四份派生 props：owner / renderSlots / store / inject face。
4. 业务组件禁止 `useSyncExternalStore`、禁止手写订阅、禁止 import 另一个插件的组件。
5. 跨插件只走 slot 或 ctx 服务。`./client` 不要导出实现组件。
6. 可变的共享视图状态用 register 时声明的 store；会话事实留在 runtime 对象层，不要塞进 store。
7. 样式用 CSS Modules + 语义 token，禁止字面颜色和组件库。产品文案中文，代码注释英文。

## 验证

- 该包出现在 Web 启动图（`window.__DSH_BOOT__` / `/plugins/<id>/client.js` 能拉到）。
- 目标 slot 上能看到贡献；关掉该 Host 行后贡献消失。
- 桌面与窄视口都看过。有交互就按用户规则走浏览器验证，不要只截一张图。

设置卡片：树外插件不要指望改 harness 的 api-proxy 白名单。给用户文档，让他们用 profile patch 配 Host 插件；或自建设置 slot，不走内置「插件配置」页。
