type UserAgentDetails = Partial<
  Record<'architecture' | 'bitness' | 'model' | 'platform' | 'platformVersion', string>
>

export type DeviceNavigator = {
  deviceMemory?: number
  hardwareConcurrency?: number
  platform?: string
  userAgentData?: {
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

  try {
    const details = await deviceNavigator.userAgentData?.getHighEntropyValues?.([
      'architecture',
      'bitness',
      'model',
      'platform',
      'platformVersion',
    ])

    platform = details?.platform || platform
    platformVersion = details?.platformVersion || ''
    architecture = details?.architecture || ''
    bitness = details?.bitness || ''
    model = details?.model || ''
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

  return specs.join(' · ') || 'Device details unavailable'
}
