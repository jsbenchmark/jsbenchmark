import { calculateStatistics } from './statistics'
import type { BenchmarkStatistics } from './statistics'
import type { BenchmarkRunResult } from './run'

export type BenchmarkSummary = {
  averageTime: number
  batchSize: number
  elapsedMs: number
  iterations: number
  opsPerSecond: number
  statistics: BenchmarkStatistics
}

export const summarizeBenchmark = (measurement: BenchmarkRunResult): BenchmarkSummary => {
  if (measurement.elapsedMs <= 0) {
    throw new Error('A benchmark requires positive elapsed time')
  }
  if (measurement.iterations <= 0) {
    throw new Error('A benchmark requires at least one iteration')
  }

  return {
    averageTime: measurement.elapsedMs / measurement.iterations,
    batchSize: measurement.batchSize,
    elapsedMs: measurement.elapsedMs,
    iterations: measurement.iterations,
    opsPerSecond: (measurement.iterations * 1000) / measurement.elapsedMs,
    statistics: calculateStatistics(measurement.samplesMsPerOperation),
  }
}
