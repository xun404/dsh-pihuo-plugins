#!/usr/bin/env node
/**
 * Chrome DevTools Protocol helper for the dsh Web UI (not Electron).
 *
 * Talks to Chrome/Chromium launched with `--remote-debugging-port`
 * (default 9222, loopback only). Commands:
 *
 *   node scripts/cdp-check.mjs list
 *   node scripts/cdp-check.mjs wait
 *   node scripts/cdp-check.mjs pageinfo
 *   node scripts/cdp-check.mjs console
 *   node scripts/cdp-check.mjs dom '<css>'
 *   node scripts/cdp-check.mjs text '<css>'
 *   node scripts/cdp-check.mjs eval '<js>'
 *   node scripts/cdp-check.mjs shot /tmp/dsh.png
 *
 * Env: CDP_HOST (127.0.0.1), CDP_PORT (9222), DSH_WEB_ORIGIN (127.0.0.1:3080),
 *      CDP_WAIT_MS (30000) for `wait`.
 *
 * No npm deps. Node 22+ global WebSocket, else optional `ws`.
 */
import { writeFileSync } from 'node:fs'

const CDP_HOST = process.env.CDP_HOST || '127.0.0.1'
const CDP_PORT = process.env.CDP_PORT || '9222'
const WEB_ORIGIN = process.env.DSH_WEB_ORIGIN || '127.0.0.1:3080'
const WAIT_MS = Number(process.env.CDP_WAIT_MS || 30_000)

const USAGE = `usage: node scripts/cdp-check.mjs <command> [arg]
commands: list | wait | pageinfo | console | dom <css> | text <css> | eval <js> | shot <file>
env: CDP_HOST CDP_PORT DSH_WEB_ORIGIN CDP_WAIT_MS`

/**
 * Choose the dsh Web page target.
 * Prefers a `type=page` whose URL contains DSH_WEB_ORIGIN, then any page
 * that is not a DevTools window.
 */
async function listTargets() {
  const res = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/list`)
  if (!res.ok) {
    throw new Error(`CDP list failed HTTP ${res.status} — is Chrome listening on ${CDP_HOST}:${CDP_PORT}?`)
  }
  return res.json()
}

async function getPageTarget() {
  const list = await listTargets()
  const pages = list.filter((t) => t.type === 'page' && t.title !== 'DevTools')
  const wanted = pages.find((t) => typeof t.url === 'string' && t.url.includes(WEB_ORIGIN))
    ?? pages[0]
  if (!wanted) throw new Error('no page target found')
  return wanted
}

let WebSocketImpl
try {
  if (typeof WebSocket !== 'undefined') {
    WebSocketImpl = WebSocket
  } else {
    WebSocketImpl = (await import('ws')).WebSocket
  }
} catch {
  console.error('No WebSocket available. Use Node 22+ or install ws.')
  process.exit(1)
}

let msgId = 0
const pending = new Map()

function send(ws, method, params = {}) {
  const id = ++msgId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

function onWs(ws, event, handler) {
  if (typeof ws.addEventListener === 'function') {
    ws.addEventListener(event, handler)
  } else {
    ws.on(event, handler)
  }
}

/**
 * Open one CDP session on the chosen page, run `fn`, then close.
 * Enables Runtime/Page/DOM. `eval` uses awaitPromise so async IIFEs work.
 */
async function withCdp(fn) {
  const page = await getPageTarget()
  const ws = new WebSocketImpl(page.webSocketDebuggerUrl)
  await new Promise((r, rej) => {
    onWs(ws, 'open', r)
    onWs(ws, 'error', rej)
  })
  onWs(ws, 'message', (ev) => {
    const raw =
      typeof ev?.data === 'string'
        ? ev.data
        : (ev?.data?.toString?.() ?? ev?.toString?.() ?? String(ev))
    const m = JSON.parse(typeof raw === 'string' ? raw : raw.toString())
    if (m.id && pending.has(m.id)) {
      pending.get(m.id).resolve(m)
      pending.delete(m.id)
    }
  })
  try {
    await send(ws, 'Runtime.enable')
    await send(ws, 'Page.enable')
    await send(ws, 'DOM.enable')
    return await fn(ws, send, page)
  } finally {
    ws.close()
  }
}

const cmd = process.argv[2]
const arg = process.argv[3]

async function evalInPage(ws, sendFn, expr) {
  const r = await sendFn(ws, 'Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  })
  if (r.result?.exceptionDetails) {
    return {
      error: r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text,
    }
  }
  return r.result?.result?.value
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

if (cmd === undefined || cmd === 'help' || cmd === '-h' || cmd === '--help') {
  console.log(USAGE)
  process.exit(cmd === undefined ? 1 : 0)
}

if (cmd === 'list') {
  try {
    const list = await listTargets()
    console.log(JSON.stringify(list.map((t) => ({
      type: t.type,
      title: t.title,
      url: t.url,
    })), null, 2))
  } catch (e) {
    console.error('CDP error:', e.message)
    process.exit(1)
  }
  process.exit(0)
}

if (cmd === 'wait') {
  const started = Date.now()
  let last = 'not started'
  while (Date.now() - started < WAIT_MS) {
    try {
      const version = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/version`)
      if (!version.ok) {
        last = `cdp HTTP ${version.status}`
      } else {
        const page = await getPageTarget()
        if (typeof page.url === 'string' && page.url.includes(WEB_ORIGIN)) {
          console.log(JSON.stringify({ ready: true, url: page.url, title: page.title }, null, 2))
          process.exit(0)
        }
        last = `page url ${page.url} does not include ${WEB_ORIGIN}`
      }
    } catch (e) {
      last = e.message
    }
    await sleep(300)
  }
  console.error(`CDP wait timed out after ${WAIT_MS}ms: ${last}`)
  process.exit(1)
}

await withCdp(async (ws, sendFn, page) => {
  if (cmd === 'dom' || cmd === 'text') {
    const prop = cmd === 'dom' ? 'outerHTML' : 'textContent'
    const expr = `(() => {
      const els = document.querySelectorAll(${JSON.stringify(arg)});
      return Array.from(els).map(e => e.${prop});
    })()`
    const out = await evalInPage(ws, sendFn, expr)
    if (out?.error) {
      console.error('ERR:', out.error)
      process.exit(1)
    }
    console.log(JSON.stringify(out, null, 2))
  } else if (cmd === 'eval') {
    const out = await evalInPage(ws, sendFn, arg)
    if (out?.error) {
      console.error('ERR:', out.error)
      process.exit(1)
    }
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2))
  } else if (cmd === 'console') {
    const msgs = []
    onWs(ws, 'message', (ev) => {
      const raw =
        typeof ev?.data === 'string'
          ? ev.data
          : (ev?.data?.toString?.() ?? ev?.toString?.() ?? String(ev))
      const m = JSON.parse(typeof raw === 'string' ? raw : raw.toString())
      if (m.method === 'Runtime.consoleAPICalled' || m.method === 'Runtime.exceptionThrown') {
        msgs.push(m.params)
      }
    })
    await sendFn(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const errors = (window.__capturedErrors ||= []);
        return 'page-alive:' + document.querySelectorAll('*').length + ' els';
      })()`,
      returnByValue: true,
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    console.log('--- console events captured in 500ms window ---')
    console.log(JSON.stringify(msgs, null, 2).slice(0, 3000))
  } else if (cmd === 'shot') {
    if (!arg) {
      console.error('shot requires an output path')
      process.exit(1)
    }
    const r = await sendFn(ws, 'Page.captureScreenshot', { format: 'png' })
    if (r.result?.data) {
      writeFileSync(arg, Buffer.from(r.result.data, 'base64'))
      console.log('screenshot saved to', arg, `(${r.result.data.length} b64 chars)`)
    } else {
      console.error('screenshot failed', r)
      process.exit(1)
    }
  } else if (cmd === 'pageinfo') {
    const out = await evalInPage(
      ws,
      sendFn,
      `(() => {
        const boot = window.__DSH_BOOT__;
        const entries = Array.isArray(boot && boot.entries) ? boot.entries : [];
        return {
          url: location.href,
          title: document.title,
          hasComposerCard: !!document.querySelector('[data-composer-card]'),
          hasComposerInput: !!document.querySelector('[data-composer-card] textarea'),
          acpWorkerRows: document.querySelectorAll('[data-acp-worker]').length,
          chatAnchors: document.querySelectorAll('[data-chat-anchor-key]').length,
          bootRev: boot && typeof boot.rev === 'string' ? boot.rev : null,
          bootEntryIds: entries.map(e => e && e.id),
          hasUiAcpWorker: entries.some(e => e && (
            e.id === '@pihuo/dsh-pihuo-acp-ui' || String(e.id).includes('pihuo-acp-ui')
          )),
        };
      })()`,
    )
    console.log(JSON.stringify({ cdpTarget: { url: page.url, title: page.title }, page: out }, null, 2))
  } else {
    console.error(USAGE)
    process.exit(1)
  }
}).catch((e) => {
  console.error('CDP error:', e.message)
  process.exit(1)
})
