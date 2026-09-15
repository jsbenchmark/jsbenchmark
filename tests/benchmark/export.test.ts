import { describe, expect, it } from 'vitest'
import { formatBenchmarkResults } from '../../app/utils/benchmark/export'
import type { TestCase, TestState } from '../../app/types'

const cases: TestCase[] = [
  {
    id: 'fast',
    code: '',
    dependencies: [],
    name: 'Fast | case',
  },
  {
    id: 'failed',
    code: '',
    dependencies: [],
    name: 'Failed, "case"',
  },
]

const stateByTest: Record<string, TestState> = {
  fast: {
    status: 'success',
    result: {
      averageTime: 0.5,
      batchSize: 4,
      elapsedMs: 1_500,
      iterations: 3_000,
      opsPerSecond: 2_000,
      statistics: {
        mean: 0.51,
        median: 0.5,
        p95: 0.6,
        relativeMarginOfError: 1.25,
        sampleCount: 42,
        standardDeviation: 0.04,
      },
    },
  },
  failed: {
    status: 'error',
    error: new Error('Expected value, received "nope"'),
  },
}

describe('formatBenchmarkResults', () => {
  it('creates a readable Markdown report with statistics and errors', () => {
    const output = formatBenchmarkResults('Array lookup', cases, stateByTest, 'markdown')

    expect(output).toContain('# Array lookup')
    expect(output).toContain(
      '| Benchmark | Test | Status | Error | Ops/s | Average | Mean batch | Median | p95 | Std deviation | 95% RME | Batches | Operations | Measured | Relative |'
    )
    expect(output).toContain(
      '| Array lookup | Fast \\| case | Success |  | 2,000 | 500 µs | 510 µs | 500 µs | 600 µs | 40 µs | 1.25% | 42 | 3,000 | 1.5 s | Fastest |'
    )
    expect(output).toContain('Expected value, received "nope"')
    expect(output).toContain('Latency statistics are per-operation averages from timed batches.')
  })

  it('creates CSV with raw numeric values and correctly escaped text', () => {
    const output = formatBenchmarkResults('Array lookup', cases, stateByTest, 'csv')
    const lines = output.split('\n')

    expect(lines[0]).toBe(
      'Benchmark,Test,Status,Error,Ops/s,Average (ms/op),Mean batch (ms/op),Median (ms/op),p95 (ms/op),Std deviation (ms/op),95% RME (%),Batches,Operations,Measured (ms),Relative (% slower)'
    )
    expect(lines[1]).toBe(
      'Array lookup,Fast | case,success,,2000,0.5,0.51,0.5,0.6,0.04,1.25,42,3000,1500,0'
    )
    expect(lines[2]).toContain('"Failed, ""case"""')
    expect(lines[2]).toContain('"Expected value, received ""nope"""')
  })

  it('prevents user-authored CSV text from becoming spreadsheet formulas', () => {
    const output = formatBenchmarkResults(
      'Array lookup',
      [{ ...cases[1]!, name: '=2+2' }],
      {
        failed: {
          status: 'error',
          error: new Error('@SUM(1, 2)'),
        },
      },
      'csv'
    )

    expect(output.split('\n')[1]).toContain("Array lookup,'=2+2,error")
    expect(output.split('\n')[1]).toContain('"\'@SUM(1, 2)"')
  })

  it('creates structured JSON without discarding measurement precision', () => {
    const output = formatBenchmarkResults('Array lookup', cases, stateByTest, 'json')
    const report = JSON.parse(output)

    expect(report.name).toBe('Array lookup')
    expect(report.results[0]).toMatchObject({
      test: 'Fast | case',
      status: 'success',
      opsPerSecond: 2_000,
      averageTimeMs: 0.5,
      batchSize: 4,
      elapsedMs: 1_500,
      iterations: 3_000,
      relativeToFastestPercent: 0,
      statistics: {
        meanMsPerOperation: 0.51,
        medianMsPerOperation: 0.5,
        p95MsPerOperation: 0.6,
        relativeMarginOfErrorPercent: 1.25,
        sampleCount: 42,
        standardDeviationMsPerOperation: 0.04,
      },
    })
    expect(report.results[1]).toEqual({
      test: 'Failed, "case"',
      status: 'error',
      error: 'Expected value, received "nope"',
    })
  })
})
