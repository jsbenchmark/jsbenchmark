import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { Config, TestCase, TestState } from '../types'
import { TARGET_BATCH_TIME } from '../utils/constants'
import type { DomRunPayload } from '../utils/benchmark/dom/protocol'
import { createDomBenchmarkSession, type DomBenchmarkSession } from '../utils/benchmark/dom/session'
import {
  getBenchmarkWatchdogTimeout,
  normalizeBenchmarkExecutionError,
  runBenchmarkCases,
} from '../utils/benchmark/execution'
import type { PreparedBenchmarkCase } from '../utils/benchmark/execution'
import { resolveBenchmarkMode } from '../utils/benchmark/modes'
import { resolveBenchmarkRuntime } from '../utils/benchmark/runtimes'
import type { BenchmarkRuntime } from '../utils/benchmark/runtimes'
import { runBenchmark } from '../utils/benchmark/run'
import type { BenchmarkRunResult } from '../utils/benchmark/run'
import { summarizeBenchmark } from '../utils/benchmark/summary'
import { useWebWorkerFn } from '../utils/worker'
import { useBenchmarkRunStatus, useBenchmarkVisibilityWarning } from './benchmark-run-status'
import { useCompile } from './compile'

type UseBenchmarkExecutionOptions = {
  cases: Ref<TestCase[]>
  config: Ref<Config>
  stateByTest: Ref<Record<string, TestState>>
}

const cloneTestCase = (test: TestCase): TestCase => ({
  ...test,
  dependencies: (test.dependencies || []).map((dependency) => ({ ...dependency })),
})

export function useBenchmarkExecution({
  cases,
  config,
  stateByTest,
}: UseBenchmarkExecutionOptions) {
  const compile = useCompile()
  const runStatus = useBenchmarkRunStatus()
  const visibilityWarning = useBenchmarkVisibilityWarning()
  const isRunningAllTests = ref(false)
  const activeExecutionCount = ref(0)
  const isAnyTestRunning = computed(() => activeExecutionCount.value > 0)
  let activeDomSession: DomBenchmarkSession | undefined
  let activeWorkerRuns = 0
  let stopWorkerVisibilityListener: (() => void) | undefined

  const snapshotConfig = (): Config => ({
    ...config.value,
    globalTestConfig: cloneTestCase(config.value.globalTestConfig),
  })

  const prepareBenchmarkCase = async (
    test: TestCase,
    runConfig: Config
  ): Promise<PreparedBenchmarkCase> => {
    const dependencies = [
      ...(runConfig.globalTestConfig.dependencies || []),
      ...(test.dependencies || []),
    ].filter((dependency) => dependency.url)
    const [code, dataCode] = await Promise.all([
      compile.whenEnabled({ code: test.code }),
      compile.whenEnabled({ code: runConfig.dataCode }),
    ])
    const benchmarkSettings = resolveBenchmarkMode(runConfig.benchmarkMode)

    return {
      caseName: test.name,
      dependencies,
      options: {
        code,
        dataCode,
        targetBatchTime: TARGET_BATCH_TIME,
        time: benchmarkSettings.time,
        warmupTime: benchmarkSettings.warmupTime,
        async: test.async,
      },
    }
  }

  const executeWorker = async (
    preparedCase: PreparedBenchmarkCase,
    timeout: number
  ): Promise<BenchmarkRunResult> => {
    const { workerFn, workerTerminate } = useWebWorkerFn(runBenchmark, {
      timeout,
      dependencies: preparedCase.dependencies,
      esm: preparedCase.dependencies.some((dependency) => dependency.esm),
    })

    try {
      return await workerFn(preparedCase.options)
    } finally {
      workerTerminate()
    }
  }

  const startExecution = () => {
    activeExecutionCount.value += 1
    let finished = false
    return () => {
      if (finished) return
      finished = true
      activeExecutionCount.value = Math.max(0, activeExecutionCount.value - 1)
    }
  }

  const startWorkerVisibilityTracking = () => {
    activeWorkerRuns += 1
    if (activeWorkerRuns === 1) {
      const update = () => visibilityWarning.setHidden(document.hidden, 'worker')
      document.addEventListener('visibilitychange', update)
      stopWorkerVisibilityListener = () => document.removeEventListener('visibilitychange', update)
      update()
    }

    let finished = false
    return () => {
      if (finished) return
      finished = true
      activeWorkerRuns = Math.max(0, activeWorkerRuns - 1)
      if (activeWorkerRuns > 0) return
      stopWorkerVisibilityListener?.()
      stopWorkerVisibilityListener = undefined
      visibilityWarning.finish()
    }
  }

  const openDomSession = () => {
    if (activeDomSession) throw new Error('A DOM benchmark is already running.')
    const session = createDomBenchmarkSession({
      onVisibilityChange: (hidden) => visibilityWarning.setHidden(hidden, 'dom'),
    })
    activeDomSession = session
    return session
  }

  const closeDomSession = (session: DomBenchmarkSession) => {
    session.close()
    if (activeDomSession === session) activeDomSession = undefined
    visibilityWarning.finish()
  }

  const executeCase = async (
    test: TestCase,
    runConfig: Config,
    runtime: BenchmarkRuntime,
    domSession?: DomBenchmarkSession,
    domResponseTimeoutMs?: number
  ) => {
    const benchmarkSettings = resolveBenchmarkMode(runConfig.benchmarkMode)
    stateByTest.value[test.id] = {
      status: 'running',
      error: null,
      estimatedDurationMs: benchmarkSettings.time + benchmarkSettings.warmupTime,
    }
    const stopVisibilityTracking =
      runtime === 'worker' ? startWorkerVisibilityTracking() : undefined

    try {
      if (domSession) await domSession.ready
      const preparedCase = await prepareBenchmarkCase(test, runConfig)
      const result = domSession
        ? await domSession.run(
            { ...preparedCase, setupHtml: runConfig.setupHtml } satisfies DomRunPayload,
            benchmarkSettings.timeout,
            domResponseTimeoutMs
          )
        : await executeWorker(preparedCase, benchmarkSettings.timeout)

      stateByTest.value[test.id] = {
        status: 'success',
        error: null,
        result: summarizeBenchmark(result),
      }
    } catch (error) {
      const normalizedError = normalizeBenchmarkExecutionError(error, benchmarkSettings.timeout)
      console.error(
        `${runtime === 'dom' ? 'DOM runner' : 'Worker'} failed: ${normalizedError.message}`
      )
      stateByTest.value[test.id] = {
        status: 'error',
        error: normalizedError,
        result: undefined,
      }

      if (normalizedError.message.toLowerCase().startsWith('unexpected')) {
        usePredefinedNotifications().typescriptHint()
      }
    } finally {
      stopVisibilityTracking?.()
    }
  }

  const runCase = async (sourceTest: TestCase) => {
    const runConfig = snapshotConfig()
    const runtime = resolveBenchmarkRuntime(runConfig.runtime)
    if (runtime === 'dom' && activeDomSession) return

    const finishExecution = startExecution()
    const test = cloneTestCase(sourceTest)
    let domSession: DomBenchmarkSession | undefined
    try {
      domSession = runtime === 'dom' ? openDomSession() : undefined
      await executeCase(test, runConfig, runtime, domSession)
    } finally {
      if (domSession) closeDomSession(domSession)
      finishExecution()
    }
  }

  const run = async () => {
    const runConfig = snapshotConfig()
    const runtime = resolveBenchmarkRuntime(runConfig.runtime)
    const tests = cases.value.map(cloneTestCase)
    if (!tests.length || (runtime === 'dom' && activeDomSession)) return

    const finishExecution = startExecution()
    let domSession: DomBenchmarkSession | undefined
    let statusStarted = false

    try {
      domSession = runtime === 'dom' ? openDomSession() : undefined
      isRunningAllTests.value = true
      const benchmarkSettings = resolveBenchmarkMode(runConfig.benchmarkMode)
      const domResponseTimeoutMs = getBenchmarkWatchdogTimeout(
        runtime,
        runConfig.parallel,
        benchmarkSettings.timeout,
        tests.length
      )
      runStatus.start({
        estimatedTestDurationMs: benchmarkSettings.time + benchmarkSettings.warmupTime,
        label: benchmarkSettings.label,
        parallel: runConfig.parallel,
        runtime,
        totalTests: tests.length,
      })
      statusStarted = true
      await runBenchmarkCases(tests, runConfig.parallel, async (test, index) => {
        runStatus.startTest(index + 1)
        await executeCase(test, runConfig, runtime, domSession, domResponseTimeoutMs)
      })
    } finally {
      if (statusStarted) {
        const failedTests = tests.filter(
          (test) => stateByTest.value[test.id]?.status === 'error'
        ).length
        runStatus.finish(failedTests)
      }
      if (domSession) closeDomSession(domSession)
      isRunningAllTests.value = false
      finishExecution()
    }
  }

  watch(
    () => config.value.runtime,
    (runtime, previousRuntime) => {
      const resolvedRuntime = resolveBenchmarkRuntime(runtime)
      if (runtime !== resolvedRuntime) {
        config.value.runtime = resolvedRuntime
        return
      }
      if (previousRuntime !== undefined && runtime !== previousRuntime) stateByTest.value = {}
    }
  )

  onScopeDispose(() => {
    activeDomSession?.close()
    activeDomSession = undefined
    activeWorkerRuns = 0
    stopWorkerVisibilityListener?.()
    stopWorkerVisibilityListener = undefined
    visibilityWarning.finish()
  })

  return { isAnyTestRunning, isRunningAllTests, run, runCase }
}
