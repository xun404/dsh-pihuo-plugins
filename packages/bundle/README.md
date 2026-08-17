# @pihuo/dsh-pihuo

[English](https://github.com/xun404/dsh-pihuo-plugins/blob/main/README_en.md) | [中文](https://github.com/xun404/dsh-pihuo-plugins/blob/main/README.md)

DeepSeek Harness **bundle** that runs local [ACP](https://agentclientprotocol.com) processes as workers in a chat.

This is the only `dsh.bundle` in [dsh-pihuo-plugins](https://github.com/xun404/dsh-pihuo-plugins). Installing it pulls the Host plugin, Web UI, and the PiHuo Leader preset.

## Install

Requires [Node.js](https://nodejs.org/) 22+ and [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

```sh
dsh plugin --profile web add @pihuo/dsh-pihuo
dsh web
```

Open `http://127.0.0.1:3080/`, then **Settings → ACP Worker**. Add a worker from the official catalog and trust it. New sessions should use **PiHuo Leader**.

Prerelease:

```sh
dsh plugin --profile web add @pihuo/dsh-pihuo@next
```

## What it contributes

| Package | Role |
|---|---|
| `@pihuo/dsh-pihuo-acp-worker` | Host: `ctx.subagents` provider `pihuo-acp` |
| `@pihuo/dsh-pihuo-acp-ui` | Web UI: settings, team header, tool cards |
| `@pihuo/dsh-pihuo-presets` | Copies `pihuo-leader` into `$DSH_HOME/.agent-presets` |

## License

MIT. Source: [xun404/dsh-pihuo-plugins](https://github.com/xun404/dsh-pihuo-plugins).
