import Bowser from 'bowser'

type BrowserBrand = { brand: string; version: string }

type UserAgentDetails = Partial<
  Record<'architecture' | 'bitness' | 'model' | 'platform' | 'platformVersion', string>
> & { fullVersionList?: BrowserBrand[] }

export type DeviceNavigator = {
  deviceMemory?: number
  hardwareConcurrency?: number
  platform?: string
  userAgent?: string
  userAgentData?: {
    brands?: BrowserBrand[]
    platform?: string
    getHighEntropyValues?: (hints: string[]) => Promise<UserAgentDetails>
  }
}

export const getDeviceSpecs = async (
  deviceNavigator: DeviceNavigator = navigator as DeviceNavigator
) => {
  let platform = deviceNavigator.userAgentData?.platform || deviceNavigator.platform
  let platformVersion = ''
  let architecture = ''
  let bitness = ''
  let model = ''
  let fullVersionList: BrowserBrand[] | undefined

  try {
    const details = await deviceNavigator.userAgentData?.getHighEntropyValues?.([
      'architecture',
      'bitness',
      'model',
      'platform',
      'platformVersion',
      'fullVersionList',
    ])

    platform = details?.platform || platform
    platformVersion = details?.platformVersion || ''
    architecture = details?.architecture || ''
    bitness = details?.bitness || ''
    model = details?.model || ''
    fullVersionList = details?.fullVersionList
  } catch {
    // Detailed device information may be unavailable due to browser privacy settings.
  }

  const specs: string[] = []

  if (model) specs.push(model)

  const platformLabel = [platform, platformVersion].filter(Boolean).join(' ')
  if (platformLabel) specs.push(platformLabel)

  const processorLabel = [architecture, bitness && `${bitness}-bit`].filter(Boolean).join(' ')
  if (processorLabel) specs.push(processorLabel)

  const logicalCores = deviceNavigator.hardwareConcurrency
  if (logicalCores) {
    specs.push(`${logicalCores} logical CPU ${logicalCores === 1 ? 'core' : 'cores'}`)
  }

  if (deviceNavigator.deviceMemory) {
    specs.push(`${deviceNavigator.deviceMemory} GB RAM`)
  }

  let browserLabel = ''

  if (deviceNavigator.userAgent) {
    const parser = Bowser.getParser(deviceNavigator.userAgent, true, {
      brands: fullVersionList ?? deviceNavigator.userAgentData?.brands,
    })
    const browser = parser.getBrowser()
    const brand = browser.name === 'Chrome' ? 'Google Chrome' : browser.name
    const fullVersion = fullVersionList?.find((entry) => entry.brand === brand)?.version

    if (browser.name) {
      browserLabel = [browser.name, fullVersion || browser.version].filter(Boolean).join(' ')
    }
  }

  return {
    device: specs.join(' · ') || 'Device details unavailable',
    browser: browserLabel,
  }
}
