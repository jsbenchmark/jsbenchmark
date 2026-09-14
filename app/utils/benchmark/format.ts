const formatNumber = (value: number, locales?: Intl.LocalesArgument) =>
  value.toLocaleString(locales, { maximumSignificantDigits: 4 })

export const formatDuration = (
  milliseconds: number | undefined,
  locales?: Intl.LocalesArgument
) => {
  if (milliseconds === undefined) return '?'

  const absoluteMilliseconds = Math.abs(milliseconds)
  if (absoluteMilliseconds >= 1_000) return `${formatNumber(milliseconds / 1_000, locales)} s`
  if (absoluteMilliseconds >= 1) return `${formatNumber(milliseconds, locales)} ms`
  if (absoluteMilliseconds >= 0.001) return `${formatNumber(milliseconds * 1_000, locales)} µs`
  return `${formatNumber(milliseconds * 1_000_000, locales)} ns`
}
