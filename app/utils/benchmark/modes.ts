export const BENCHMARK_MODES = {
  quick: { label: 'Quick', time: 1_000, warmupTime: 250 },
  standard: { label: 'Standard', time: 3_000, warmupTime: 500 },
  extended: { label: 'Extended', time: 8_000, warmupTime: 1_000 },
} as const

export type BenchmarkMode = keyof typeof BENCHMARK_MODES

export const DEFAULT_BENCHMARK_MODE: BenchmarkMode = 'standard'

export const resolveBenchmarkMode = (mode: unknown) => {
  const resolvedMode =
    typeof mode === 'string' && Object.hasOwn(BENCHMARK_MODES, mode)
      ? (mode as BenchmarkMode)
      : DEFAULT_BENCHMARK_MODE
  const settings = BENCHMARK_MODES[resolvedMode]

  return {
    ...settings,
    mode: resolvedMode,
    timeout: settings.time + settings.warmupTime + 2_000,
  }
}
