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
const WANT_REASONING = process.env.MOCK_REASONING === '1'
const THINK = process.env.MOCK_THINK ?? ''
const TOOL = process.env.MOCK_TOOL ?? ''

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

const REASONING_OPTIONS = [
  { value: 'low', name: 'Low' },
  { value: 'high', name: 'High' },
]

function reasoningConfig(currentValue) {
  return {
    id: 'reasoning_effort',
    name: 'Reasoning',
    category: 'thought_level',
    type: 'select',
    currentValue,
    options: REASONING_OPTIONS,
  }
}

function configOptions(modelValue, reasoningValue) {
  const rows = []
  if (WANT_MODELS) rows.push(modelConfig(modelValue))
  if (WANT_REASONING) rows.push(reasoningConfig(reasoningValue))
  return rows
}

let resolveHang
let currentModel = 'flash'
let currentReasoning = 'low'

agent({ name: 'pihuo-mock-acp' })
  .onRequest('initialize', async () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', async () => ({
    sessionId: 'mock-session',
    ...WANT_MODELS || WANT_REASONING
      ? { configOptions: configOptions(currentModel, currentReasoning) }
      : {},
  }))
  .onRequest('session/set_config_option', async (ctx) => {
    const id = String(ctx.params.configId ?? '')
    const value = String(ctx.params.value ?? '')
    if (id === 'model') currentModel = value
    if (id === 'reasoning_effort') currentReasoning = value
    return { configOptions: configOptions(currentModel, currentReasoning) }
  })
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
    if (THINK !== '') {
      await ctx.client.notify('session/update', {
        sessionId,
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: THINK },
        },
      })
    }
    if (TOOL !== '') {
      await ctx.client.notify('session/update', {
        sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tool-1',
          title: TOOL,
          status: 'completed',
          kind: 'read',
        },
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
