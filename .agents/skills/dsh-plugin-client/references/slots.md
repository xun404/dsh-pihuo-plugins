# Slots 与双面加载

## 注册

```ts
export const inject = ['slots']

export function apply(ctx: ClientContext) {
  ctx.slots.register({
    name: 'settings.plugins.tab',
    children: {
      'settings.plugin.item': { kind: 'list', scope: 'global' },
    },
    inject: () => ({ /* 纯数据与回调，禁止 ReactNode */ }),
  }, MyTab)
}
```

- slot 名镜像组合路径：`<domain>.<entry>.<hole>`。
- 排序看贡献的 `order`。
- `inject` 工厂闭包可以使用 apply 里的 ctx；返回值必须是 JSON 兼容数据或回调。需要响应式私有事实时用 inject 的 `hooks` 隔间，组件只看到绑定后的 `use<Name>`。

## 加载链

1. Host Loader 挂上声明了 `dsh.client` 的包。
2. `client-modules` 的 Node 半在 `internal/plugin` 上增量扫描，编写 `WebBootGraph`。
3. 页面 HTML 注入 `__DSH_BOOT__`；脚本从 `/plugins/<id>/client.js` 拉取。
4. 浏览器半是惰性 CJS：先 `load({ id, factory })`，`require` 时才执行 factory（含 CSS）。
5. 外壳的 vendored Loader 用 `ClientModuleLoader` 当 `internal`，只替换 import。

`<id>/client` 与裸 id 指向同一表层。require 环会抛错。

## Chat 节点

新的对话行：注册 `ConversationNodeDefinition` + keyed `conversation.chat.node` renderer。

- `match(event)` 只读当前事件。
- 同一 Context 里每条事件携带或能独立推出同一业务 id。
- `update` 按 log `seq` 可重放。禁止在热路径扫描整个事件窗。

## 动态浏览器半

`cordis_run` 带浏览器半时要等人在页面上允许。没有页面的部署（headless）会一直挂到轮次取消。这不是安装型 UI 插件的路径。
