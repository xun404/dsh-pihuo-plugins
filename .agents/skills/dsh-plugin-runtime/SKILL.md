---
name: dsh-plugin-runtime
description: >
  DeepSeek Harness Cordis runtime — Fiber lifecycle, inject, services, events,
  effects, isolate, HMR. Use when debugging plugin load/unload, PENDING/FAILED
  fibers, missing ctx.tools/ctx.llm, event dispatch modes, or the user says
  /dsh-plugin-runtime, "插件加载失败", "fiber", "inject 不生效", "HMR".
metadata:
  short-description: Cordis plugin runtime
---

# Cordis 运行时

dsh 没有特权内核：产品每一部分都是插件。本技能只讲进程内运行时。配置树如何叠出来见 [dsh-plugin-compose](../dsh-plugin-compose/SKILL.md)。

对照源码：`../deepseek-harness/vendor/cordis`、`vendor/loader`。

细节展开：[references/cordis.md](references/cordis.md)。

## 加载一条插件时发生什么

1. Loader 按条目 `name` import 模块（`unwrapExports` 处理 CJS/ESM/default）。
2. `Registry.plugin` 把函数 / `{ apply }` / 类 归一成 callback，按 callback 身份建 Runtime。
3. 为这次挂载建 Fiber。有 `inject` 则先 `PENDING`，服务齐了再跑 callback。
4. 函数/对象走 `apply(ctx, config)`；类则 `new Ctor(ctx, config)`，再跑 `[Service.init]`。
5. 通过 `ctx` 的注册记在该 Fiber 的 effect 列表上。

YAML 行序**不**决定启动顺序。启动顺序 = 服务依赖图。

## Fiber 状态

```text
PENDING → LOADING → ACTIVE
                 ↘ FAILED
ACTIVE → UNLOADING → DISPOSED
```

| 状态 | 含义 | 常见原因 |
|---|---|---|
| PENDING | 依赖未齐 | `inject` 写了尚未 `provide` 的 key；或写错了服务名 |
| LOADING | 正在执行 apply | 同步 apply 里做了重 I/O 会卡住观感 |
| ACTIVE | 在跑 | — |
| FAILED | apply / Config 抛错 | schema 校验失败、import 失败、apply throw |
| UNLOADING / DISPOSED | 已卸 | 父组 disable、依赖消失、HMR、`fiber.dispose()` |

依赖服务消失 → 本插件 DISPOSED；服务回来 → 重新加载。这是设计，不要用全局单例绕过。

排障顺序：`dsh --profile <name> --dump-config` 确认行在树里 → 查 Fiber 是 PENDING 还是 FAILED → PENDING 对 `inject` 与提供方 id；FAILED 看 loader 日志与 Config schema。

## 必须遵守的运行时规则

- `apply` 开始时，`inject` 里的服务已就绪。不要在模块顶层读 `ctx`。
- 可选依赖：不写 `inject`，用 `ctx.get('name')`。
- 提供服务：`Service` 子类 `super(ctx, 'key')`，并 `declare module '@deepseek-ai/cordis' { interface Context { key: ... } }`。Host 与 Client 不要复用同一个 Context key 表达不兼容的类型。
- 事件模式必须与声明一致。Waterfall 观察者必须 `next()`；策略监听器可以短路。不要对 waterfall 事件用 `emit`。
- `ctx.plugin(child)` 的子 Fiber 随父卸载。
- 多个异步 disposer **并发**执行。顺序清理必须放进同一个 `ctx.effect` 返回的函数里串行 await。
- Web 发行组合默认关掉共享 HMR（`dsh-web-app` 把 `hmr` 行 `disabled: true`）。不要假设改源文件会热替换 Web 进程。

## isolate

同一服务名可以有多个实例。条目上：

```yaml
isolate:
  shell: true          # 本条目私有 realm
  # shell: my-label    # 同 label 共享一个 GlobalRealm
```

Agent preset 用 isolate 让不同会话看到不同能力集。树外插件不要随便 isolate 核心服务，除非就是要一份私有实例。
