import type { Config, Dependency, TestCase } from '../../types'
import { DEFAULT_TEST_NAME } from '../constants'
import type { BenchmarkRuntime } from './runtimes'

type BenchmarkExampleCase = Omit<TestCase, 'id' | 'dependencies'> & {
  dependencies: readonly Dependency[]
}

export type BenchmarkExample = {
  name: string
  dataCode: string
  setupHtml: string
  cases: readonly BenchmarkExampleCase[]
}

export const DEFAULT_WORKER_BENCHMARK_EXAMPLE: BenchmarkExample = {
  name: DEFAULT_TEST_NAME,
  dataCode: 'return [...Array(1000).keys()]',
  setupHtml: '',
  cases: [
    { code: 'DATA.find(i => i === 99)', name: 'Find 99', dependencies: [] },
    { code: 'DATA.find(i => i === 199)', name: 'Find 199', dependencies: [] },
    { code: 'DATA.find(i => i === 499)', name: 'Find 499', dependencies: [] },
  ],
}

export const DEFAULT_DOM_BENCHMARK_EXAMPLE: BenchmarkExample = {
  name: 'DOM element selection',
  dataCode: 'return document',
  setupHtml: '<button id="target" data-target>Target</button>',
  cases: [
    { code: "DATA.getElementById('target')", name: 'getElementById', dependencies: [] },
    { code: "DATA.querySelector('#target')", name: 'Query ID selector', dependencies: [] },
    {
      code: "DATA.querySelector('[data-target]')",
      name: 'Query data attribute',
      dependencies: [],
    },
  ],
}

export const createBenchmarkExampleCases = (
  example: BenchmarkExample,
  createId: () => string
): TestCase[] =>
  example.cases.map((test) => ({
    ...test,
    id: createId(),
    dependencies: test.dependencies.map((dependency) => ({ ...dependency })),
  }))

const matchesBenchmarkExample = (
  config: Config,
  cases: readonly TestCase[],
  example: BenchmarkExample
) =>
  config.name === example.name &&
  config.dataCode === example.dataCode &&
  config.setupHtml === example.setupHtml &&
  !config.globalTestConfig.dependencies?.length &&
  cases.length === example.cases.length &&
  example.cases.every((test, index) => {
    const candidate = cases[index]
    if (!candidate) return false
    return (
      candidate.name === test.name &&
      candidate.code === test.code &&
      Boolean(candidate.async) === Boolean(test.async) &&
      Boolean(candidate.esm) === Boolean(test.esm) &&
      !candidate.dependencies?.length
    )
  })

export const getBenchmarkExampleForRuntimeChange = (
  config: Config,
  cases: readonly TestCase[],
  runtime: BenchmarkRuntime
) => {
  if (
    runtime === 'dom' &&
    matchesBenchmarkExample(config, cases, DEFAULT_WORKER_BENCHMARK_EXAMPLE)
  ) {
    return DEFAULT_DOM_BENCHMARK_EXAMPLE
  }
  if (
    runtime === 'worker' &&
    matchesBenchmarkExample(config, cases, DEFAULT_DOM_BENCHMARK_EXAMPLE)
  ) {
    return DEFAULT_WORKER_BENCHMARK_EXAMPLE
  }
}
