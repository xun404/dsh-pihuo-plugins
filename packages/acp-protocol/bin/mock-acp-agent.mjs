#!/usr/bin/env node
/**
 * Scripted ACP 1.2 agent over stdio for local verification.
 *
 * Env:
 *   MOCK_TEXT        assistant chunk (default "mock child answer")
 *   MOCK_STOP        ACP stopReason (default "end_turn")
 *   MOCK_HANG        "1" waits for session/cancel
 *   MOCK_PERMISSION  "1" asks session/request_permission first
 */
import { Readable, Writable } from 'node:stream'
import { agent, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'

const TEXT = process.env.MOCK_TEXT ?? 'mock child answer'
const STOP = process.env.MOCK_STOP ?? 'end_turn'
const HANG = process.env.MOCK_HANG === '1'
const WANT_PERMISSION = process.env.MOCK_PERMISSION === '1'
const WANT_MODELS = process.env.MOCK_MODELS === '1'

const MODEL_OPTIONS = [
  { value: 'flash', name: 'Flash' },
  { value: 'pro', name: 'Pro' },
]

function modelConfig(currentValue) {
  return {
    id: 'model',
    name: 'Model',
    category: 'model',
    type: 'select',
    currentValue,
    options: MODEL_OPTIONS,
  }
}

let resolveHang

agent({ name: 'pihuo-mock-acp' })
  .onRequest('initialize', async () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', async () => ({
    sessionId: 'mock-session',
    ...WANT_MODELS ? { configOptions: [modelConfig('flash')] } : {},
  }))
  .onRequest('session/set_config_option', async (ctx) => ({
    configOptions: [modelConfig(String(ctx.params.value ?? 'flash'))],
  }))
  .onRequest('session/prompt', async (ctx) => {
    const sessionId = ctx.params.sessionId
    if (WANT_PERMISSION) {
      await ctx.client.request('session/request_permission', {
        sessionId,
        toolCall: { toolCallId: 'perm-1', title: 'mock permission' },
        options: [
          { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
          { optionId: 'deny', name: 'Deny', kind: 'reject_once' },
        ],
      })
    }
    await ctx.client.notify('session/update', {
      sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: TEXT },
      },
    })
    if (HANG) {
      const reason = await new Promise((resolve) => {
        resolveHang = resolve
      })
      return { stopReason: reason }
    }
    return { stopReason: STOP }
  })
  .onNotification('session/cancel', () => {
    resolveHang?.('cancelled')
  })
  .connect(
    ndJsonStream(
      Writable.toWeb(process.stdout),
      Readable.toWeb(process.stdin),
    ),
  )
