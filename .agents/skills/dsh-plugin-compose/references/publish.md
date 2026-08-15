# 组合包清单

## package.json（树外）

```json
{
  "name": "dsh-example",
  "version": "0.1.0",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "default": "./lib/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["lib/index.js", "lib/types/**/*.d.ts", "cordis.patch.yml"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "peerDependencies": {
    "@deepseek-ai/cordis": "*",
    "@deepseek-ai/dsh-tools": "*"
  },
  "scripts": {
    "prepare": "tsdown",
    "build": "tsdown"
  }
}
```

- `dsh.bundle.patch` 相对包根。
- 只 `inject` 的服务定义放 `peerDependencies`，不要打进自己的 node_modules 当第二份 cordis。
- `files` 必须包含 patch 和运行入口。不要发布 `src` 当唯一入口，除非 `prepare` 稳定产出 `lib/`。

## cordis.patch.yml

```yaml
- insert:
    - id: example
      name: dsh-example
      config:
        timeoutMs: 30000
```

`name` 用包名（让 Node 从 profile 解析），不要用作者机器上的相对源码路径。

覆盖第一方行时重述完整 `config`。参考 `../deepseek-harness/packages/bundle/web-app/cordis.patch.yml`。

## 构建

Git 安装拉源码，不跑 `build`，只跑 `prepare`（还要用户 `allowBuilds`）。`prepare` 必须自包含：

- 不要依赖旁边的 monorepo project references
- 不要假设全局已 `pnpm install` 了 harness
- 用专用 tsdown 直接转译 `src/`

优先分发方式：npm 上的预构建包，或 `pnpm pack` 的 tarball。这两种不需要 prepare 授权。

锁定 git 依赖：`github:org/repo#<sha>`。

## 发现

仓库加 GitHub topic `dsh-plugin`。
