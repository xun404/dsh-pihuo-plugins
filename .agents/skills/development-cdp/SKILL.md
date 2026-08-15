---
name: development-cdp
description: >
  Inspect and automate the DeepSeek Harness Web UI through Chrome DevTools
  Protocol (CDP). Use when verifying dsh-pihuo plugins in the browser, checking
  startup, composer, or tool cards, taking screenshots, or running
  scripts/cdp-check.mjs. Triggers: CDP, Chrome remote debugging, pageinfo,
  "网页调试", /development-cdp.
metadata:
  short-description: CDP-debug dsh Web UI
---

# Development CDP (dsh Web)

This repo's UI is the **dsh browser app**, not PiHuo's Electron shell. Drive a
Chrome/Chromium tab whose origin is the dsh host. Do not attach to a random
tab, and do not treat `router-agents` `:8315` as this project.

Authoritative checker: `scripts/cdp-check.mjs` (no extra npm deps; Node 22+).

## Process map

Two processes, restarted separately:

| Process | Default | Role |
|---|---|---|
| dsh host | `http://127.0.0.1:3080` | Cordis tree, `/api`, `/plugins/<id>/client.js` |
| Chrome with CDP | `127.0.0.1:9222` | The actual Web UI |

Web profile **disables shared HMR**. A plugin source change needs a **dsh restart**
(and a hard reload). A stale host serves an old `__DSH_BOOT__`.

Packaged Chrome without `--remote-debugging-port` cannot be attached after the fact.

## Start

From this repo, after `pnpm build`:

```sh
node scripts/write-dev-patch.mjs /tmp/dsh-pihuo-web.patch.yml
NODE_PATH=/tmp/dsh-pihuo-node_modules \
  pnpm --dir ../deepseek-harness exec dsh --profile web --patch /tmp/dsh-pihuo-web.patch.yml
```

`write-dev-patch.mjs` writes package-name rows (so
`__DSH_BOOT__.entries[].id` equals the client factory id
`@pihuo/dsh-ui-acp-worker`) and symlinks this checkout under
`NODE_PATH=/tmp/dsh-pihuo-node_modules`. Do **not** use absolute
`src/index.ts` paths for a `dsh.client` package: `client-modules` keys the
graph by Loader `name`, and a path id will not match `lib/client.js`.

Do **not** `--patch packages/bundle/cordis.patch.yml` against a stock web
profile: those names are not in the profile, and empty `args` refuse
`start()`.

Chrome (loopback only — CDP has no auth):

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/dsh-pihuo-cdp \
  http://127.0.0.1:3080
```

Wait for **both** before automating:

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/
node scripts/cdp-check.mjs wait
```

Override ports:

```sh
CDP_PORT=9333 DSH_WEB_ORIGIN=127.0.0.1:8080 node scripts/cdp-check.mjs pageinfo
```

## Commands

```sh
node scripts/cdp-check.mjs list               # CDP targets
node scripts/cdp-check.mjs wait               # CDP + origin ready
node scripts/cdp-check.mjs pageinfo           # first call every session
node scripts/cdp-check.mjs console
node scripts/cdp-check.mjs dom '[data-composer-card]'
node scripts/cdp-check.mjs text '[data-acp-worker]'
node scripts/cdp-check.mjs eval "<js>"        # awaitPromise: true
node scripts/cdp-check.mjs shot /tmp/dsh.png
```

`pageinfo` reports URL, composer presence, `[data-acp-worker]` count, chat
anchors, and `__DSH_BOOT__.entries` ids (the wire is `{ rev, entries }`, not
`.plugins`). The UI plugin is composed when `hasUiAcpWorker` is true.

Client bundle format: [dsh-plugin-client](../dsh-plugin-client/SKILL.md).

## Driving chat

**Stateful inspection:** `eval` in the page. **Gestures you must see:** DOM
clicks. Prefer visible text over `:nth-child`.

React controlled composer — native setter + `input`:

```sh
node scripts/cdp-check.mjs eval "(() => {
  const ta = document.querySelector('[data-composer-card] textarea');
  if (!ta) return 'no textarea';
  const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  set.call(ta, 'Call acp_worker to list the workspace root.');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return { value: ta.value, phase: ta.getAttribute('data-phase') };
})()"
```

Scope reads to the visible conversation. Prefer `[data-composer-card]` in the
visible column and `[data-chat-anchor-key]` for tool rows. Our Worker row is
`[data-acp-worker]`. Missing after a completed `acp_worker` call means the
generic card ran — the client factory is not in the boot graph, or
`lib/client.js` is not a `__ModuleLoader__` bundle.

## Pitfalls

1. **Wait for the host, not just CDP.** A Chrome tab on a down `:3080` is an
   error page. `pageinfo.url` must contain the dsh origin.
2. **This is not Electron.** PiHuo's `:8315` and `window.routerAgents` do not
   exist here. Do not curl `:4111`.
3. **React inputs ignore `.value =`.** Use the native setter + `input`.
4. **HMR is off on the web profile.** Restart `dsh` after plugin edits.
5. **`__DSH_BOOT__` is `{ rev, entries }`.** `entries[].id` is the loader
   `name` (the package name for a `dsh.client` row).
6. **`eval` accepts `await`.** Wrap fetches in an async IIFE.
7. **Never bind CDP off loopback.** No application auth on the debug port.
8. **Do not `session.append` new event types** to “make CDP see a node.” Chat
   state comes from first-party `tool/call` / `tool/result` (see HANDOVER).
9. **Pick the dsh tab.** `list` then confirm `DSH_WEB_ORIGIN`; DevTools windows
   are skipped, other localhost tabs are not.
