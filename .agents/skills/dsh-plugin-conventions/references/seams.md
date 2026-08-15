# 能力 seam

一项可替换能力是 **seam**，由三种角色一起构成。单一角色不是 seam。

| 角色 | 职责 | 依赖 |
|---|---|---|
| Service Definition | 声明 `ctx.<key>`、类型、事件 | cordis |
| Service Provider | 实现该接口 | Definition |
| Consumer | 把能力暴露给模型或 UI（工具、命令、卡片） | Definition |

Provider 与 Consumer **互不 import**。

Bash 样板：

```text
dsh-shell (ctx.shell)  ←  dsh-bash-local
        ↑
   dsh-tool-bash
```

换提供方（本地 / 远程沙箱）时，Definition 与工具不动。文件系统与进程共享执行世界：把它们指到同一沙箱，Bash、PTY、LSP 一起走，不要为每个工具做专用 fork。

## 何时拆包

拆：提供方会换、接口与呈现会独立演进、或两边的依赖集明显不同。

不拆：一次性功能、没有第二提供方、拆开只会多三个几乎空的 package.json。

树外插件常见组合：一个包同时是 Provider+Consumer（例如封装外部 API 的工具）。只要不把接口泄漏成「只有这个包才能用的 ctx key」即可。若预期别人会换后端，先抽出 Definition。

## 声明合并

```ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    myCap: MyCapService
  }
}
```

类型合并在编译期跨 Host/Client 程序可见。不要在 Client 包里用同一个 key 声明一个长得完全不同的服务。
