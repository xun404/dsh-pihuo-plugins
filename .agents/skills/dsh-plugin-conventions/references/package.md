# 包与角色命名

树外包不套用 harness monorepo 的 `private: true` / workspace 约束，但角色命名与导出纪律仍适用。

## 导出

- Host 入口：`apply` / `inject` / `name` / `Config`。不要把内部 helper 做成包的公共 API。
- Client 入口（若有）：只导出 loading 需要的符号。跨包协作走 slot 或 ctx，禁止 import 另一个插件的组件。
- 源码相对 import 带显式 `.ts` 后缀（与 harness 一致），构建器写回 `.js`。

## 角色词

| 词 | 用 |
|---|---|
| Registry | 动态具名注册，含去重、生命周期 |
| Provider | 某一 Definition 的一种实现；多种实现时加机制/厂商限定 |
| Policy | 决定允许/选择/限额 |
| Gateway | 适配进程、网络、RPC 边界 |
| Controller | 接受用户意图，改已有领域或呈现状态 |
| Store | 拥有一份数据的 CRUD/快照/订阅 |
| Runtime | 拥有调度、取消、跨调用生命周期 |
| Resolver | 由输入算出一个答案，不拥有其生命周期 |

不要：用 `Service` 当找不到更准的词；用 `SDK` 称呼本仓库的插件；复用已有复数 key。

## README

每个可安装插件写清：提供什么、inject 什么、Config 字段、挂了哪些事件/工具、已知限制。若向模型注入提示词或工具 schema，写明模型看得到什么。不要复制 harness 子系统目录。
