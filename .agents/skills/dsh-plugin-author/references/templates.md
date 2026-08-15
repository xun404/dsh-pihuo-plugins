# 插件模板

只放可复制的骨架。契约解释在对应技能里。

## 函数插件

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export const name = 'example'
export const inject = ['tools']

export interface Config {
  timeoutMs: number
}

export const Config: Schema<Config> = Schema.object({
  timeoutMs: Schema.number().default(30_000),
})

export function apply(ctx: Context, config: Config) {
  ctx.logger.info('example loaded, timeoutMs=%s', config.timeoutMs)
}
```

`Config` 必须是 Standard Schema（Schemastery）。不要 `export const Config = { timeoutMs: 30000 }`。

## 对象形态 / 类形态

```ts
export default {
  name: 'example',
  inject: ['tools'],
  apply(ctx: Context) {},
}
```

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    example: ExampleService
  }
}

export default class ExampleService extends Service {
  static inject = ['tools']

  constructor(ctx: Context) {
    super(ctx, 'example')
  }
}
```

## 工具插件

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'greet-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: {
      name: { type: 'string', required: true, description: 'The name to greet' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      return `Hello, ${args.name}!`
    },
  }))
}
```

### execute 契约

- `defineTool` 在 `execute` 前按 schema 校验 args；`execute` 里把 args 当只读。
- `execute` 只返回 `output.schema` 对应的规范 JSON 值，不要返回 content block。
- 面向模型的散文放 `output.render`；面向 UI 的卡片放 `presentCall` / `presentResult`（必须是纯函数，禁止 I/O / 读时钟 / 读会话）。
- 抛错或返回不合 schema 的值 → 工具失败（`isError`）。领域上的「非理想成功」（如非零退出码）应编码进规范值。
- 前台工作必须尊重 `exec.signal`。
- 政策不要写进 `execute`：`tools/pre-execute` 做允许/拒绝；`ctx.tools.guard()` 做不可撤销的最终拒绝。
- 后台任务走 `ctx.jobs.start`，成功分支返回类似 `{ kind: 'background', jobId }` 的规范句柄，不要让 Code Mode 去解析散文里的 id。

## 钩子插件

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'

export const name = 'permission-gate'

export function apply(ctx: Context) {
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (blocked(exec)) return { kind: 'deny', reason: 'Denied by policy.' }
    return next()
  })
}
```

Waterfall 监听器要短路时才不调 `next()`。观察者必须 `return next()`。

## LLM 适配器

```ts
export const name = 'llm-my-vendor'
export const inject = ['llm']

export function apply(ctx: Context) {
  ctx.llm.registerAdapter(['my-vendor'], adapter)
}
```

适配器实现以 harness 的 `docs/cookbook/adding-an-llm-adapter.md` 与现有 `@deepseek-ai/dsh-llm-deepseek` 为准，不要在本仓库发明第二套流式词汇表。

## 自定义资源

```ts
export function apply(ctx: Context) {
  ctx.effect(() => {
    const timer = setInterval(() => {}, 5000)
    return () => clearInterval(timer)
  })
}
```

## 开发用 overlay

```yaml
- insert:
    - id: greet
      name: '/absolute/path/to/pkg/src/index.ts'
      config:
        timeoutMs: 5000
```

`name` 必须是绝对路径。patch 文件本身不改变 Loader 解析用的 profile 目录。
