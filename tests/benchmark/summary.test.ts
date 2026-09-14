import { describe, expect, it } from 'vitest'
import { summarizeBenchmark } from '../../app/utils/benchmark/summary'

describe('summarizeBenchmark', () => {
  it('uses actual elapsed time instead of the configured time budget', () => {
    const result = summarizeBenchmark({
      batchSize: 1,
      elapsedMs: 3_500,
      iterations: 5,
      samplesMsPerOperation: [700, 700, 700, 700, 700],
    })

    expect(result.opsPerSecond).toBeCloseTo(10 / 7)
    expect(result.averageTime).toBe(700)
    expect(result.elapsedMs).toBe(3_500)
    expect(result.iterations).toBe(5)
  })

  it('keeps the unrounded throughput for downstream calculations', () => {
    const result = summarizeBenchmark({
      batchSize: 10,
      elapsedMs: 3,
      iterations: 10,
      samplesMsPerOperation: [0.3],
    })

    expect(result.opsPerSecond).toBeCloseTo(3_333.3333333333335)
    expect(result.averageTime).toBe(0.3)
  })

  it('includes statistics derived from batch samples', () => {
    const result = summarizeBenchmark({
      batchSize: 4,
      elapsedMs: 12,
      iterations: 12,
      samplesMsPerOperation: [0.5, 1, 1.5],
    })

    expect(result.statistics).toMatchObject({
      mean: 1,
      median: 1,
      p95: 1.45,
      sampleCount: 3,
      standardDeviation: 0.5,
    })
  })

  it('rejects unusable worker measurements', () => {
    expect(() =>
      summarizeBenchmark({
        batchSize: 1,
        elapsedMs: 0,
        iterations: 1,
        samplesMsPerOperation: [0],
      })
    ).toThrow('positive elapsed time')
  })
})
