import { describe, expect, it } from 'vitest'
import { calculateStatistics } from './statistics'

describe('calculateStatistics', () => {
  it('calculates location, spread, percentile, and uncertainty', () => {
    const result = calculateStatistics([1, 2, 3, 4, 5])

    expect(result.mean).toBe(3)
    expect(result.median).toBe(3)
    expect(result.p95).toBeCloseTo(4.8)
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(2.5))
    expect(result.relativeMarginOfError).toBeCloseTo(65.44, 2)
    expect(result.sampleCount).toBe(5)
  })

  it('uses a numerically stable variance calculation', () => {
    const result = calculateStatistics([1_000_000_000_001, 1_000_000_000_002, 1_000_000_000_003])

    expect(result.mean).toBe(1_000_000_000_002)
    expect(result.standardDeviation).toBe(1)
  })

  it('returns no margin of error for a single sample', () => {
    const result = calculateStatistics([7])

    expect(result).toMatchObject({
      mean: 7,
      median: 7,
      p95: 7,
      relativeMarginOfError: null,
      sampleCount: 1,
      standardDeviation: 0,
    })
  })

  it('reports zero variation for constant samples', () => {
    const result = calculateStatistics([4, 4, 4, 4])

    expect(result.standardDeviation).toBe(0)
    expect(result.relativeMarginOfError).toBe(0)
  })

  it('rejects empty and non-finite samples', () => {
    expect(() => calculateStatistics([])).toThrow('at least one sample')
    expect(() => calculateStatistics([1, Number.NaN])).toThrow('finite')
  })
})
