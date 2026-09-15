import { describe, expect, it } from 'vitest'
import {
  BENCHMARK_RUNTIMES,
  DEFAULT_BENCHMARK_RUNTIME,
  normalizeSetupHtml,
  resolveBenchmarkRuntime,
} from '../../app/utils/benchmark/runtimes'

describe('resolveBenchmarkRuntime', () => {
  it('keeps Worker as the default and exposes both supported runtimes', () => {
    expect(DEFAULT_BENCHMARK_RUNTIME).toBe('worker')
    expect(Object.keys(BENCHMARK_RUNTIMES)).toEqual(['worker', 'dom'])
    expect(resolveBenchmarkRuntime(undefined)).toBe('worker')
  })

  it('accepts only own worker and dom values', () => {
    expect(resolveBenchmarkRuntime('worker')).toBe('worker')
    expect(resolveBenchmarkRuntime('dom')).toBe('dom')
    expect(resolveBenchmarkRuntime('toString')).toBe('worker')
    expect(resolveBenchmarkRuntime(null)).toBe('worker')
    expect(resolveBenchmarkRuntime({})).toBe('worker')
  })
})

describe('normalizeSetupHtml', () => {
  it('keeps string fixtures and normalizes malformed shared values', () => {
    expect(normalizeSetupHtml('<button>Run</button>')).toBe('<button>Run</button>')
    expect(normalizeSetupHtml(undefined)).toBe('')
    expect(normalizeSetupHtml(null)).toBe('')
    expect(normalizeSetupHtml({ toString: () => '<script>bad</script>' })).toBe('')
  })
})
