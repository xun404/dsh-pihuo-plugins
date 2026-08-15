# @pihuo/dsh-acp-worker

Host plugin. Registers `ctx.subagents` provider `pihuo-acp` (config `providerName`).

Phase 1: every `start()` spawns a new ACP 1.2 child. Session reuse is phase 2.

`inject`: `subagents`, `subprocess`.

At runtime the dsh profile supplies `@deepseek-ai/cordis`, `@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-subagent`, and `@deepseek-ai/dsh-subprocess`. They are not declared as peers here because those packages are not on the public npm registry.

## Config

| Field | Default | Notes |
|---|---|---|
| `providerName` | `pihuo-acp` | Do not use first-party `acp`. |
| `command` | required | Child executable. |
| `args` | `[]` | Must be non-empty at `start()` — empty refuses so a bare `node` cannot hang. |
| `cwd` | parent session cwd | Absolute after load. |
| `permission` | `reject` | Auto policy; `ask` is phase 2. |
| `env` | `{}` | Merged after the subprocess seam scrubs parent env. |
| `disposeGraceMs` | `3000` | SIGTERM→SIGKILL grace. |

Local mock:

```yaml
command: node
args:
  - /absolute/path/to/packages/acp-protocol/bin/mock-acp-agent.mjs
permission: allow
```

`scripts/write-dev-patch.mjs` writes that overlay.
