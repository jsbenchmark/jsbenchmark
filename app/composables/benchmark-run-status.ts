import { onScopeDispose } from 'vue'
import type { BenchmarkRuntime } from '../utils/benchmark/runtimes'

export type BenchmarkRunStatus = {
  currentTest: number
  currentTestStartedAt: number
  estimatedTestDurationMs: number
  label: string
  parallel: boolean
  runtime: BenchmarkRuntime
  runStartedAt: number
  totalTests: number
}

export const getBenchmarkRunStatusMessage = (status: BenchmarkRunStatus, now: number) => {
  const elapsedMs = now - (status.parallel ? status.runStartedAt : status.currentTestStartedAt)
  const queuedTests = status.parallel ? 0 : status.totalTests - status.currentTest
  const remainingMs = Math.max(
    0,
    status.estimatedTestDurationMs - elapsedMs + queuedTests * status.estimatedTestDurationMs
  )
  const runtime = status.runtime === 'dom' ? 'DOM' : 'Worker'
  const execution = status.parallel
    ? `${runtime} · ${status.label} run`
    : `${runtime} · Sequential · ${status.label} run`
  const title = status.parallel
    ? `Running ${status.totalTests} ${status.totalTests === 1 ? 'test' : 'tests in parallel'}`
    : `Test ${status.currentTest} of ${status.totalTests}`

  return {
    title,
    description:
      remainingMs > 0
        ? `${execution} · about ${Math.ceil(remainingMs / 1_000)}s remaining`
        : `${execution} · finishing…`,
  }
}

export const useBenchmarkRunStatus = () => {
  const toast = useToast()
  let activeRun: BenchmarkRunStatus | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let toastId: string | number | undefined

  const stopTimer = () => {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  const update = () => {
    if (!activeRun || toastId === undefined) return
    toast.update(toastId, {
      ...getBenchmarkRunStatusMessage(activeRun, performance.now()),
      duration: 0,
      progress: false,
    })
  }

  const start = (
    options: Pick<
      BenchmarkRunStatus,
      'estimatedTestDurationMs' | 'label' | 'parallel' | 'runtime' | 'totalTests'
    >
  ) => {
    stopTimer()
    if (toastId !== undefined) toast.remove(toastId)
    const now = performance.now()
    activeRun = {
      ...options,
      currentTest: 1,
      currentTestStartedAt: now,
      runStartedAt: now,
    }
    const notification = toast.add({
      ...getBenchmarkRunStatusMessage(activeRun, now),
      closeIcon: 'i-tabler-x',
      color: 'primary',
      duration: 0,
      icon: 'i-tabler-clock-play',
      progress: false,
      type: 'background',
    })
    toastId = notification.id
    timer = setInterval(update, 1_000)
  }

  const startTest = (testNumber: number) => {
    if (!activeRun || activeRun.parallel) return
    activeRun.currentTest = testNumber
    activeRun.currentTestStartedAt = performance.now()
    update()
  }

  const finish = (failedTests: number) => {
    stopTimer()
    if (!activeRun || toastId === undefined) return

    if (!failedTests) {
      toast.remove(toastId)
      toastId = undefined
      activeRun = undefined
      return
    }

    const successfulTests = activeRun.totalTests - failedTests
    toast.update(toastId, {
      color: 'warning',
      description: `${successfulTests} completed · ${failedTests} failed`,
      duration: 3_000,
      icon: 'i-tabler-alert-triangle',
      progress: true,
      title: 'Benchmarks finished with errors',
    })
    activeRun = undefined
  }

  onScopeDispose(() => {
    stopTimer()
    if (toastId !== undefined) toast.remove(toastId)
  })

  return { finish, start, startTest }
}

const VISIBILITY_WARNING_DESCRIPTION =
  'The browser may throttle timers and animation frames, which can make this run less reliable.'

export const useBenchmarkVisibilityWarning = () => {
  const toast = useToast()
  let removalTimer: ReturnType<typeof setTimeout> | undefined
  let toastId: string | number | undefined

  const stopRemovalTimer = () => {
    if (removalTimer) clearTimeout(removalTimer)
    removalTimer = undefined
  }

  const remove = () => {
    stopRemovalTimer()
    if (toastId !== undefined) toast.remove(toastId)
    toastId = undefined
  }

  const notification = (runtime: BenchmarkRuntime) => ({
    title: runtime === 'dom' ? 'Benchmark runner is hidden' : 'Benchmark page was hidden',
    description: VISIBILITY_WARNING_DESCRIPTION,
    closeIcon: 'i-tabler-x',
    color: 'warning' as const,
    duration: 0,
    icon: 'i-tabler-alert-triangle',
    progress: false,
  })

  const setHidden = (hidden: boolean, runtime: BenchmarkRuntime) => {
    if (hidden) {
      stopRemovalTimer()
      if (toastId === undefined) {
        toastId = toast.add(notification(runtime)).id
      } else {
        toast.update(toastId, notification(runtime))
      }
      return
    }

    if (toastId === undefined) return
    if (runtime === 'dom') {
      remove()
      return
    }

    toast.update(toastId, { ...notification(runtime), duration: 3_000, progress: true })
    removalTimer = setTimeout(remove, 3_000)
  }

  onScopeDispose(remove)

  return { finish: remove, setHidden }
}
