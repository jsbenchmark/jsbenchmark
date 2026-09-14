import { describe, expect, it } from 'vitest'
import { DEFAULT_BENCHMARK_MODE, resolveBenchmarkMode } from '../../app/utils/benchmark/modes'

describe('resolveBenchmarkMode', () => {
  it('keeps the existing timing as the standard default', () => {
    expect(DEFAULT_BENCHMARK_MODE).toBe('standard')
    expect(resolveBenchmarkMode(undefined)).toMatchObject({
      time: 3_000,
      warmupTime: 500,
    })
  })

  it('provides quick and extended run lengths', () => {
    expect(resolveBenchmarkMode('quick')).toMatchObject({ time: 1_000, warmupTime: 250 })
    expect(resolveBenchmarkMode('extended')).toMatchObject({ time: 8_000, warmupTime: 1_000 })
  })

  it('falls back to standard for values from an older or malformed shared URL', () => {
    expect(resolveBenchmarkMode('unknown')).toEqual(resolveBenchmarkMode('standard'))
    expect(resolveBenchmarkMode(null)).toEqual(resolveBenchmarkMode('standard'))
  })

  it('derives a timeout with setup and final-batch slack', () => {
    expect(resolveBenchmarkMode('standard').timeout).toBe(5_500)
    expect(resolveBenchmarkMode('extended').timeout).toBe(11_000)
  })
})
