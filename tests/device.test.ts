import { describe, expect, it } from 'vitest'
import { getDeviceSpecs } from '../app/utils/device'

const chromeUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'

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
    ).resolves.toEqual({
      device: 'Example Model · Example OS 15.0 · arm 64-bit · 8 logical CPU cores · 16 GB RAM',
      browser: '',
    })
  })

  it('falls back to commonly available platform and core information', async () => {
    await expect(
      getDeviceSpecs({
        hardwareConcurrency: 1,
        platform: 'MacIntel',
      })
    ).resolves.toEqual({ device: 'MacIntel · 1 logical CPU core', browser: '' })
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
    ).resolves.toEqual({ device: 'Linux x86_64 · 4 logical CPU cores', browser: '' })
  })

  it('describes the absence of browser device information', async () => {
    await expect(getDeviceSpecs({})).resolves.toEqual({
      device: 'Device details unavailable',
      browser: '',
    })
  })

  it.each([
    [chromeUserAgent, 'Chrome 153.0.0.0'],
    [`${chromeUserAgent} Edg/153.0.100.2`, 'Microsoft Edge 153.0.100.2'],
    [`${chromeUserAgent} OPR/122.0.1.2`, 'Opera 122.0.1.2'],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:155.0) Gecko/20100101 Firefox/155.0',
      'Firefox 155.0',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
      'Safari 18.5',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/153.0.8010.12 Mobile/15E148 Safari/604.1',
      'Chrome 153.0.8010.12',
    ],
  ])('includes %s browser details without Client Hints', async (userAgent, browser) => {
    await expect(getDeviceSpecs({ platform: 'Example OS', userAgent })).resolves.toEqual({
      device: 'Example OS',
      browser,
    })
  })

  it('prefers the matching full browser version over reduced user-agent versions', async () => {
    await expect(
      getDeviceSpecs({
        userAgent: `${chromeUserAgent} Edg/153.0.0.0`,
        userAgentData: {
          getHighEntropyValues: async (hints) => {
            expect(hints).toContain('fullVersionList')

            return {
              fullVersionList: [
                { brand: 'Not A Brand', version: '99.0.0.0' },
                { brand: 'Chromium', version: '153.0.8010.12' },
                { brand: 'Microsoft Edge', version: '153.0.100.2' },
              ],
            }
          },
        },
      })
    ).resolves.toEqual({
      device: 'Device details unavailable',
      browser: 'Microsoft Edge 153.0.100.2',
    })
  })

  it('matches Chrome to its Google Chrome Client Hint brand', async () => {
    await expect(
      getDeviceSpecs({
        userAgent: chromeUserAgent,
        userAgentData: {
          getHighEntropyValues: async () => ({
            fullVersionList: [{ brand: 'Google Chrome', version: '153.0.8010.12' }],
          }),
        },
      })
    ).resolves.toEqual({
      device: 'Device details unavailable',
      browser: 'Chrome 153.0.8010.12',
    })
  })

  it('retains browser identity from available brands when detailed hints are blocked', async () => {
    await expect(
      getDeviceSpecs({
        platform: 'Linux x86_64',
        userAgent: chromeUserAgent,
        userAgentData: {
          brands: [
            { brand: 'Chromium', version: '153' },
            { brand: 'Brave', version: '153' },
          ],
          getHighEntropyValues: async () => {
            throw new Error('Not allowed')
          },
        },
      })
    ).resolves.toEqual({ device: 'Linux x86_64', browser: 'Brave 153' })
  })

  it('includes the browser name when its version is unavailable', async () => {
    await expect(getDeviceSpecs({ userAgent: 'Safari' })).resolves.toEqual({
      device: 'Device details unavailable',
      browser: 'Safari',
    })
  })

  it('omits unrecognized browser information', async () => {
    await expect(
      getDeviceSpecs({ platform: 'Example OS', userAgent: 'unrecognized' })
    ).resolves.toEqual({ device: 'Example OS', browser: '' })
  })
})
