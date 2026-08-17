# PiHuo

English | [中文](README.md)

PiHuo is a set of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) **out-of-tree plugins**. It runs local [ACP](https://agentclientprotocol.com) processes as workers in a chat, dispatched by the Leader.

**Everything is a plugin.** The runtime is [Cordis](https://github.com/cordiverse/cordis). This repository does not patch harness.

## Developer preview

PiHuo is in _developer preview_ and tracks `dsh` closely. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Install

Requires [Node.js](https://nodejs.org/) 22+ and DeepSeek Harness.

### Install from `npm`

```sh
dsh plugin --profile web add @pihuo/dsh-pihuo
dsh web
```

The Web UI is served at `http://127.0.0.1:3080/` by default.

Open **ACP Worker** in Settings, add a worker from the official catalog, and trust it. New sessions should use **PiHuo Leader**.

Prerelease (npm dist-tag `next`):

```sh
dsh plugin --profile web add @pihuo/dsh-pihuo@next
```

Bundle: [`@pihuo/dsh-pihuo`](https://www.npmjs.com/package/@pihuo/dsh-pihuo).

### Run from source

```sh
git clone https://github.com/xun404/dsh-pihuo-plugins.git
cd dsh-pihuo-plugins
pnpm install
pnpm test
pnpm typecheck
pnpm build
node scripts/write-dev-patch.mjs /tmp/dsh-pihuo-web.patch.yml
npx --yes @deepseek-ai/dsh web --patch /tmp/dsh-pihuo-web.patch.yml
```

Open `http://127.0.0.1:3080/`.

## Features

- Add workers from the official ACP catalog. Install first if the CLI is missing, then save
- Enable, trust, model, and thinking come from a live ACP probe
- PiHuo Leader only dispatches. It does not use the host session's files or shell
- Each chat can form a team: assign role, model, and thinking to registered workers
- Calling `acp_worker` seats the worker on the team
- The run card shows thought, tools, and replies in arrival order

## Community and support

- Bugs and feedback: [GitHub Issues](https://github.com/xun404/dsh-pihuo-plugins/issues)
- This repository carries the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic
- DeepSeek Harness: [repo](https://github.com/deepseek-ai/deepseek-harness) · [Discord](https://discord.gg/Ycq5dCaS4)

## Development

Agents should follow [AGENTS.md](AGENTS.md). Progress lives in [HANDOVER.md](HANDOVER.md).

Push a `vX.Y.Z` tag to publish `packages/*` to npmjs. Prerelease tags such as `v0.1.0-rc.1` use dist-tag `next`.

## License

[MIT](LICENSE)
