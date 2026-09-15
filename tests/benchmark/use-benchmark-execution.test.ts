import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Config, TestCase, TestState } from '../../app/types'
import { useBenchmarkExecution } from '../../app/composables/benchmark-execution'

const mocks = vi.hoisted(() => ({
  compileWhenEnabled: vi.fn(async () => {
    throw new Error('compile failed')
  }),
  finishStatus: vi.fn(),
  finishVisibility: vi.fn(),
  setHidden: vi.fn(),
  startStatus: vi.fn(),
  startTest: vi.fn(),
}))

vi.mock('../../app/composables/compile', () => ({
  useCompile: () => ({ whenEnabled: mocks.compileWhenEnabled }),
}))

vi.mock('../../app/composables/benchmark-run-status', () => ({
  useBenchmarkRunStatus: () => ({
    finish: mocks.finishStatus,
    start: mocks.startStatus,
    startTest: mocks.startTest,
  }),
  useBenchmarkVisibilityWarning: () => ({
    finish: mocks.finishVisibility,
    setHidden: mocks.setHidden,
  }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useBenchmarkExecution', () => {
  it('keeps the active-run lock independent of displayed case rows', async () => {
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      hidden: false,
      removeEventListener: vi.fn(),
    })
    const test: TestCase = {
      id: 'case-a',
      name: 'Case A',
      code: '1 + 1',
      dependencies: [],
    }
    const cases = ref([test])
    const config = ref<Config>({
      benchmarkMode: 'quick',
      runtime: 'worker',
      name: 'Activity test',
      parallel: true,
      dataCode: 'return null',
      setupHtml: '',
      globalTestConfig: { id: 'setup', code: '', dependencies: [] },
    })
    const stateByTest = ref<Record<string, TestState>>({})
    const scope = effectScope()
    const execution = scope.run(() => useBenchmarkExecution({ cases, config, stateByTest }))!
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const run = execution.runCase(test)
    expect(execution.isAnyTestRunning.value).toBe(true)

    cases.value = []
    expect(execution.isAnyTestRunning.value).toBe(true)

    await run
    expect(execution.isAnyTestRunning.value).toBe(false)
    scope.stop()
  })
})
