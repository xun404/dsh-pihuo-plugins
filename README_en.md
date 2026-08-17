# dsh-pihuo-plugins

[中文](README.md)

A DeepSeek Harness plugin that runs local ACP processes as workers in a chat.

## Features

- Add workers from the official ACP catalog. Install first if the CLI is missing, then save
- Enable, trust, model, and thinking come from a live ACP probe
- PiHuo Leader only dispatches. It does not use the host session's files or shell
- Each chat can form a team: assign role, model, and thinking to registered workers
- Calling `acp_worker` seats the worker on the team
- The run card shows thought, tools, and replies in arrival order

## Install

```sh
dsh plugin --profile web add @pihuo/dsh-pihuo
```

Then open ACP Worker in Settings, add from the catalog, and trust the worker. New sessions should use PiHuo Leader.

## Release

Push a `vX.Y.Z` tag. GitHub Actions publishes every `packages/*` package to [npmjs](https://www.npmjs.com). Prerelease tags such as `v0.1.0-rc.1` use the `next` dist-tag and do not replace `latest`.

One-time setup:

1. Create a public `pihuo` org at [npmjs.com](https://www.npmjs.com/org/create).
2. Create a granular access token (read and write, `@pihuo/*`, allow publishing new packages).
3. Add it as the `NPM_TOKEN` Actions secret.

```sh
git tag v0.1.0
git push origin v0.1.0
```

CI writes the tag version onto each package before publish. You do not need a bump commit.

## Local development

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
node scripts/write-dev-patch.mjs /tmp/dsh-pihuo-web.patch.yml
npx --yes @deepseek-ai/dsh web --patch /tmp/dsh-pihuo-web.patch.yml
```

Open http://127.0.0.1:3080/
