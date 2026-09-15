import { describe, expect, it } from 'vitest'
import { getDeviceSpecs } from '../app/utils/device'

describe('getDeviceSpecs', () => {
  it('formats the detailed device information exposed by the browser', async () => {
    await expect(
      getDeviceSpecs({
        deviceMemory: 16,
        hardwareConcurrency: 8,
        platform: 'fallback platform',
        userAgentData: {
          platform: 'fallback OS',
          getHighEntropyValues: async () => ({
            architecture: 'arm',
            bitness: '64',
            model: 'Example Model',
            platform: 'Example OS',
            platformVersion: '15.0',
          }),
        },
      })
    ).resolves.toBe(
      'Example Model · Example OS 15.0 · arm 64-bit · 8 logical CPU cores · 16 GB RAM'
    )
  })

  it('falls back to commonly available platform and core information', async () => {
    await expect(
      getDeviceSpecs({
        hardwareConcurrency: 1,
        platform: 'MacIntel',
      })
    ).resolves.toBe('MacIntel · 1 logical CPU core')
  })

  it('keeps available fallbacks when detailed information is blocked', async () => {
    await expect(
      getDeviceSpecs({
        hardwareConcurrency: 4,
        platform: 'Linux x86_64',
        userAgentData: {
          getHighEntropyValues: async () => {
            throw new Error('Not allowed')
          },
        },
      })
    ).resolves.toBe('Linux x86_64 · 4 logical CPU cores')
  })

  it('describes the absence of browser device information', async () => {
    await expect(getDeviceSpecs({})).resolves.toBe('Device details unavailable')
  })
})
