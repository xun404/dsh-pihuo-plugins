# 层与 patch

## 条目字段

| 字段 | 含义 |
|---|---|
| `id` | 稳定身份。patch / isolate / inventory 都靠它。新建必填且勿事后改。 |
| `name` | 模块 specifier：包名、绝对路径、相对 `baseUrl` 的路径 |
| `config` | 传给插件；有 schema 则先校验 |
| `group` | 本行是组，`config` 为子条目列表 |
| `disabled` | 字面值或 `!!js`；组自身视为启用，但会关掉非组子孙 |
| `inject` | 额外依赖或 intercept，与模块 `export const inject` 叠加 |
| `isolate` / `intercept` | 服务隔离与拦截。语义见 runtime |

行序无加载语义。

## `applyEntryPatches` 行为

输入被 `structuredClone`，结果与输入脱钩。热加载去掉某条 patch 时才能回到旧值。

- `insert` 且无 `id` → 追加到根列表
- `insert` 且有 `id` → 追加到该 group 的 `config`（目标必须是 group）
- 非 insert 必须有 `id`；找不到 → warn 跳过
- 提供了 `name` 且与目标不同 → warn 跳过
- 其余键（含整个 `config`）赋到目标上

## 双锚点解析

`resolveBundleDir(installAnchor, profileDir)`：安装目录优先。这保证 `@deepseek-ai/dsh-base` 不会被 profile 里一份旧拷贝劫持。

Loader `baseUrl` 是 profile 目录。`--patch` overlay 只贡献条目，不改 baseUrl，所以 overlay 里的相对 `name` 仍相对 profile，**不是**相对 overlay 文件。开发期 Host 插件 `name` 用绝对路径。

声明了 `dsh.client` 的包：Loader `name` 必须是**包名**（与 `lib/client.js` 里 `__ModuleLoader__.load({ id })` 一致）。绝对 `src/index.ts` 会让 `client-modules` 永久记成「不是 client 包」；绝对包根路径能扫到 bundle，但 boot `entries[].id` 是路径，factory 对不上。本仓库 `scripts/write-dev-patch.mjs` 写包名行，并用 `NODE_PATH` 把本检出链进去。

## 用户层热加载

`watchUserPatches` 在有 HMR 时监视 profile 的 `cordis.patch.yml`，按启动时同一套 compose 函数重放。Web 组合默认 disable 了 HMR，不要依赖 Web UI 热吃用户 patch。
