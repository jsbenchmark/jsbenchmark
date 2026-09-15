import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBenchmarkRunStatusMessage,
  useBenchmarkRunStatus,
  useBenchmarkVisibilityWarning,
} from '../../app/composables/benchmark-run-status'

vi.mock('vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue')>()),
  onScopeDispose: vi.fn(),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('getBenchmarkRunStatusMessage', () => {
  it('describes parallel runs using their shared remaining time', () => {
    expect(
      getBenchmarkRunStatusMessage(
        {
          currentTest: 1,
          currentTestStartedAt: 1_000,
          estimatedTestDurationMs: 3_500,
          label: 'Standard',
          parallel: true,
          runtime: 'worker',
          runStartedAt: 1_000,
          totalTests: 3,
        },
        1_500
      )
    ).toEqual({
      title: 'Running 3 tests in parallel',
      description: 'Worker · Standard run · about 3s remaining',
    })
  })

  it('uses singular copy for a one-test run', () => {
    expect(
      getBenchmarkRunStatusMessage(
        {
          currentTest: 1,
          currentTestStartedAt: 1_000,
          estimatedTestDurationMs: 3_500,
          label: 'Standard',
          parallel: true,
          runtime: 'worker',
          runStartedAt: 1_000,
          totalTests: 1,
        },
        1_500
      ).title
    ).toBe('Running 1 test')
  })

  it('includes queued tests in a sequential run estimate', () => {
    expect(
      getBenchmarkRunStatusMessage(
        {
          currentTest: 2,
          currentTestStartedAt: 5_000,
          estimatedTestDurationMs: 3_500,
          label: 'Standard',
          parallel: false,
          runtime: 'worker',
          runStartedAt: 1_000,
          totalTests: 3,
        },
        5_500
      )
    ).toEqual({
      title: 'Test 2 of 3',
      description: 'Worker · Sequential · Standard run · about 7s remaining',
    })
  })

  it('shows a finishing state after the estimate is exhausted', () => {
    expect(
      getBenchmarkRunStatusMessage(
        {
          currentTest: 3,
          currentTestStartedAt: 8_000,
          estimatedTestDurationMs: 3_500,
          label: 'Standard',
          parallel: false,
          runtime: 'dom',
          runStartedAt: 1_000,
          totalTests: 3,
        },
        12_000
      )
    ).toEqual({
      title: 'Test 3 of 3',
      description: 'DOM · Sequential · Standard run · finishing…',
    })
  })
})

describe('useBenchmarkRunStatus', () => {
  it('removes the running toast when a run succeeds', () => {
    const remove = vi.fn()
    const update = vi.fn()
    vi.stubGlobal('useToast', () => ({
      add: vi.fn(() => ({ id: 'benchmark-run' })),
      remove,
      update,
    }))

    const status = useBenchmarkRunStatus()
    status.start({
      estimatedTestDurationMs: 3_500,
      label: 'Standard',
      parallel: true,
      runtime: 'worker',
      totalTests: 3,
    })
    status.finish(0)

    expect(remove).toHaveBeenCalledWith('benchmark-run')
    expect(update).not.toHaveBeenCalled()
  })
})

describe('useBenchmarkVisibilityWarning', () => {
  it('keeps one persistent DOM warning while hidden and removes it when visible', () => {
    const add = vi.fn(() => ({ id: 'visibility-warning' }))
    const remove = vi.fn()
    const update = vi.fn()
    vi.stubGlobal('useToast', () => ({ add, remove, update }))

    const warning = useBenchmarkVisibilityWarning()
    warning.setHidden(true, 'dom')
    warning.setHidden(true, 'dom')

    expect(add).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Benchmark runner is hidden',
        duration: 0,
        progress: false,
      })
    )

    warning.setHidden(false, 'dom')
    expect(remove).toHaveBeenCalledWith('visibility-warning')
  })

  it('retains the Worker warning briefly after the page becomes visible', () => {
    vi.useFakeTimers()
    const add = vi.fn(() => ({ id: 'visibility-warning' }))
    const remove = vi.fn()
    const update = vi.fn()
    vi.stubGlobal('useToast', () => ({ add, remove, update }))

    const warning = useBenchmarkVisibilityWarning()
    warning.setHidden(true, 'worker')
    warning.setHidden(false, 'worker')

    expect(update).toHaveBeenCalledWith(
      'visibility-warning',
      expect.objectContaining({ duration: 3_000, progress: true })
    )
    expect(remove).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3_000)
    expect(remove).toHaveBeenCalledWith('visibility-warning')
  })
})
