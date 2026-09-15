import type { Dependency } from '../../types'
import type { BenchmarkRuntime } from './runtimes'
import type { BenchmarkRunOptions } from './run'

export type PreparedBenchmarkCase = {
  caseName?: string
  dependencies: Dependency[]
  options: BenchmarkRunOptions
}

export const getBenchmarkWatchdogTimeout = (
  runtime: BenchmarkRuntime,
  parallel: boolean,
  timeoutMs: number,
  caseCount: number
) => (runtime === 'dom' && parallel ? timeoutMs * Math.max(1, caseCount) : timeoutMs)

export async function runBenchmarkCases<T>(
  cases: T[],
  parallel: boolean,
  execute: (test: T, index: number) => Promise<void>
) {
  if (parallel) {
    await Promise.all(cases.map(execute))
    return
  }

  for (const [index, test] of cases.entries()) await execute(test, index)
}

export const createBenchmarkTimeoutError = (timeoutMs: number) =>
  new Error(
    `The test was canceled because the timeout expired. Check your code for infinite loops and make sure it doesn't take longer than ${timeoutMs / 1000} seconds.`
  )

export const normalizeBenchmarkExecutionError = (error: unknown, timeoutMs: number) => {
  const eventType =
    typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined

  if (eventType === 'TIMEOUT_EXPIRED') {
    return createBenchmarkTimeoutError(timeoutMs)
  }

  if (typeof eventType === 'string') return new Error(eventType)
  return error instanceof Error ? error : new Error('Unknown error')
}
