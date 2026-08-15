# Cordis 细节

## 插件形态判定

`Registry.resolve`：函数直接用；对象必须有 `apply` 方法。`name === 'apply'` 的函数会被丢掉显示名。类通过 `isConstructor` 走 `new`。

`plugin.Config` 必须实现 Standard Schema `~standard.validate`。异步 validate 会直接抛错。失败抛 `ValidationError`，Fiber 进 FAILED。

Loader 还会把条目上的 `inject` merge 进 Fiber 的 inject（`internal/plugin` 监听里 `Inject.resolve(entry.options.inject, fiber.inject)`）。YAML `inject` 与模块 `export const inject` 是叠加关系。

## 事件分发

| 方法 | await | 顺序 | 返回值 |
|---|---|---|---|
| `emit` | 否 | 注册序 | 无 |
| `bail` | 否 | 注册序 | 第一个非 `null`/`false`/`undefined` |
| `waterfall` | 是 | 注册序，洋葱包装 | 是；不调 `next()` 即短路 |
| `parallel` | 是 | 并行 | 无 |
| `serial` | 是 | 注册序 | 第一个有意义的返回值可终止 |

Harness 产品事件用 `@mode` 标注。新事件不要混用分发方法。

产品级 waterfall：`agent/pre-step`、`agent/request`、`llm/stream`、`tools/pre-execute`、`tools/execute`、`tools/post-execute`。`agent/turn-stopping` 是 serial。

Waterfall 签名是 `(...args, next)`。`prepend: true` 仅在必须先于普通注册时使用。

## effect 与清理

`ctx.on` / `ctx.effect` / `ctx.reflect.provide` / `ctx.tools.register` 都记在当前 Fiber。`dispose` 保证：本插件注册撤销、子插件递归卸载、返回的 Promise 等异步清理结束。

Loader 对「用户在运行时 `fiber.dispose()`」会把该条目写成 `disabled: true` 并 `write()`。HMR / 换 name / 组禁用走另一条路径，不会误写成用户 disable。

## 配置插值

条目 `config` 里的 `!!js` 在该条目 inject 就绪后、用**该条目的 ctx** 求值。`disabled` 的 `!!js` 用 loader ctx 求值。Group / Include 自己的 config 保持字面值，以免提前求值子行表达式。

## import

- `cordis:` 前缀走 `loader.builtins`
- 否则走 Node 内部 ESM loader（有 `internal` 时）或动态 `import()`
- 相对路径相对 `ctx.baseUrl`（profile 目录 / Include 文件所在目录）
- 浏览器半把 `internal.import` 换成 `ClientModuleLoader`，Fiber 语义不变
