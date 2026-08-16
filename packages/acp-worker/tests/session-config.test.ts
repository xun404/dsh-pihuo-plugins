import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AcpConfigOption, AcpSessionDriver } from '@pihuo/dsh-acp-protocol'
import { applySessionConfig, SessionConfigError } from '../src/session-config.ts'

function option(partial: AcpConfigOption): AcpConfigOption {
  return partial
}

function fakeDriver(initial: AcpConfigOption[]): AcpSessionDriver {
  let options = [...initial]
  return {
    get configOptions() {
      return options
    },
    async setConfigOption(configId: string, value: string) {
      const hit = options.find(row => row.id === configId)
      if (hit === undefined) throw new Error(`no option ${configId}`)
      if (hit.options !== undefined && !hit.options.some(row => row.value === value)) {
        throw new Error(`value ${value} not in ${configId}`)
      }
      options = options.map(row => row.id === configId ? { ...row, currentValue: value } : row)
      return [...options]
    },
  } as AcpSessionDriver
}

const FLASH_OPTIONS: AcpConfigOption[] = [
  option({
    id: 'model',
    category: 'model',
    type: 'select',
    currentValue: 'opencode-go/deepseek-v4-flash',
    options: [
      { value: 'opencode-go/deepseek-v4-flash', name: 'Flash' },
      { value: 'opencode-go/deepseek-v4-pro', name: 'Pro' },
    ],
  }),
  option({
    id: 'effort',
    category: 'thought_level',
    type: 'select',
    currentValue: 'low',
    options: [
      { value: 'low', name: 'Low' },
      { value: 'high', name: 'High' },
      { value: 'max', name: 'Max' },
    ],
  }),
]

describe('applySessionConfig', () => {
  it('sets a live thought pin', async () => {
    const driver = fakeDriver(FLASH_OPTIONS)
    const applied = await applySessionConfig(driver, { reasoning: 'high' })
    assert.equal(applied.thinking, 'high')
    assert.equal(driver.configOptions.find(row => row.id === 'effort')?.currentValue, 'high')
  })

  it('drops a pin the select does not declare', async () => {
    const driver = fakeDriver(FLASH_OPTIONS)
    const applied = await applySessionConfig(driver, { reasoning: 'medium' })
    assert.equal(applied.thinking, 'low')
    assert.equal(driver.configOptions.find(row => row.id === 'effort')?.currentValue, 'low')
  })

  it('omits thinking when currentValue is not a live option', async () => {
    const stale = FLASH_OPTIONS.map(row => (
      row.id === 'effort' ? { ...row, currentValue: 'medium' } : row
    ))
    const driver = fakeDriver(stale)
    const applied = await applySessionConfig(driver, { reasoning: 'medium' })
    assert.equal(applied.thinking, undefined)
  })

  it('throws when setConfigOption fails for a live pin', async () => {
    const driver = {
      get configOptions() {
        return FLASH_OPTIONS
      },
      async setConfigOption() {
        throw new Error('agent rejected')
      },
    } as unknown as AcpSessionDriver
    await assert.rejects(
      () => applySessionConfig(driver, { reasoning: 'high' }),
      (error: unknown) => error instanceof SessionConfigError && error.code === 'ACP_REASONING_CONFIGURATION_FAILED',
    )
  })
})
