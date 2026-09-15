import { describe, expect, it } from 'vitest'
import type { Config, TestCase } from '../../app/types'
import {
  createBenchmarkExampleCases,
  DEFAULT_DOM_BENCHMARK_EXAMPLE,
  DEFAULT_WORKER_BENCHMARK_EXAMPLE,
  getBenchmarkExampleForRuntimeChange,
} from '../../app/utils/benchmark/examples'

const createConfig = (runtime: Config['runtime'] = 'worker'): Config => ({
  benchmarkMode: 'quick',
  runtime,
  name: DEFAULT_WORKER_BENCHMARK_EXAMPLE.name,
  parallel: true,
  globalTestConfig: { id: 'setup', code: '', dependencies: [] },
  dataCode: DEFAULT_WORKER_BENCHMARK_EXAMPLE.dataCode,
  setupHtml: DEFAULT_WORKER_BENCHMARK_EXAMPLE.setupHtml,
})

describe('benchmark starter examples', () => {
  it('selects the DOM example only when switching an untouched Worker starter', () => {
    const config = createConfig('dom')
    const cases = createBenchmarkExampleCases(DEFAULT_WORKER_BENCHMARK_EXAMPLE, () => 'id')

    expect(getBenchmarkExampleForRuntimeChange(config, cases, 'dom')).toBe(
      DEFAULT_DOM_BENCHMARK_EXAMPLE
    )

    cases[0]!.code = 'custom code'
    expect(getBenchmarkExampleForRuntimeChange(config, cases, 'dom')).toBeUndefined()
  })

  it('restores the Worker starter when an untouched DOM starter switches back', () => {
    const config = {
      ...createConfig('worker'),
      name: DEFAULT_DOM_BENCHMARK_EXAMPLE.name,
      dataCode: DEFAULT_DOM_BENCHMARK_EXAMPLE.dataCode,
      setupHtml: DEFAULT_DOM_BENCHMARK_EXAMPLE.setupHtml,
    }
    const cases = createBenchmarkExampleCases(DEFAULT_DOM_BENCHMARK_EXAMPLE, () => 'id')

    expect(getBenchmarkExampleForRuntimeChange(config, cases, 'worker')).toBe(
      DEFAULT_WORKER_BENCHMARK_EXAMPLE
    )
  })

  it('does not replace a starter with custom setup or dependencies', () => {
    const cases = createBenchmarkExampleCases(DEFAULT_WORKER_BENCHMARK_EXAMPLE, () => 'id')
    const customFixture = { ...createConfig('dom'), setupHtml: '<main>Custom</main>' }
    expect(getBenchmarkExampleForRuntimeChange(customFixture, cases, 'dom')).toBeUndefined()

    const customDependencies: TestCase[] = cases.map((test, index) =>
      index === 0 ? { ...test, dependencies: [{ url: '/custom.js' }] } : test
    )
    expect(
      getBenchmarkExampleForRuntimeChange(createConfig('dom'), customDependencies, 'dom')
    ).toBeUndefined()
  })

  it('creates fresh case IDs without mutating the reusable example', () => {
    const ids = ['first', 'second', 'third']
    const cases = createBenchmarkExampleCases(DEFAULT_DOM_BENCHMARK_EXAMPLE, () => ids.shift()!)

    expect(cases.map((test) => test.id)).toEqual(['first', 'second', 'third'])
    expect(cases.map((test) => test.name)).toEqual([
      'getElementById',
      'Query ID selector',
      'Query data attribute',
    ])
    expect(DEFAULT_DOM_BENCHMARK_EXAMPLE.cases.every((test) => !('id' in test))).toBe(true)
  })
})
