export const BENCHMARK_RUNTIMES = {
  worker: { label: 'Worker' },
  dom: { label: 'DOM' },
} as const

export type BenchmarkRuntime = keyof typeof BENCHMARK_RUNTIMES

export const DEFAULT_BENCHMARK_RUNTIME: BenchmarkRuntime = 'worker'

export const resolveBenchmarkRuntime = (runtime: unknown): BenchmarkRuntime =>
  typeof runtime === 'string' && Object.hasOwn(BENCHMARK_RUNTIMES, runtime)
    ? (runtime as BenchmarkRuntime)
    : DEFAULT_BENCHMARK_RUNTIME

export const normalizeSetupHtml = (setupHtml: unknown) =>
  typeof setupHtml === 'string' ? setupHtml : ''
