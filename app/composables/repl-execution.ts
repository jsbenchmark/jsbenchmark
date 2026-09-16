import { computed, nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { createReplDomFrame } from '../utils/repl/dom'
import { runReplCode } from '../utils/repl/run'
import type {
  ReplColorMode,
  ReplConfig,
  ReplOutput,
  ReplProgressEvent,
  ReplState,
} from '../utils/repl/types'
import { useWebWorkerFn } from '../utils/worker'
import { useCompile } from './compile'
import { usePredefinedNotifications } from './predefined-notifications'

const REPL_TIMEOUT_MS = 30_000

const emptyOutput = (): ReplOutput => ({ logs: [], markers: [] })

const normalizeError = (error: unknown) => {
  const eventType =
    typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined

  if (eventType === 'TIMEOUT_EXPIRED') {
    return new Error(`The code was stopped because it exceeded the 30-second timeout.`)
  }
  if (error instanceof Error) return error
  if (typeof eventType === 'string') return new Error(eventType)
  return new Error(typeof error === 'string' ? error : 'Unknown error')
}

export function useReplExecution(
  config: Ref<ReplConfig>,
  previewHost: Ref<HTMLElement | undefined>,
  previewColorMode: Readonly<Ref<ReplColorMode>>
) {
  const compile = useCompile()
  const idleState: ReplState = { status: 'idle', output: emptyOutput() }
  const activeRun = shallowRef<{
    state: Ref<ReplState>
    frame: Readonly<Ref<ReturnType<typeof createReplDomFrame> | undefined>>
    cancel: () => void
  }>()
  const state = computed(() => activeRun.value?.state.value ?? idleState)
  let disposed = false

  const reset = () => {
    activeRun.value?.cancel()
    activeRun.value = undefined
  }

  const run = async () => {
    if (disposed || state.value.status === 'running') return
    reset()
    const runConfig: ReplConfig = {
      ...config.value,
      test: {
        ...config.value.test,
        dependencies: config.value.test.dependencies
          .filter((dependency) => dependency.url)
          .map((dependency) => ({ ...dependency })),
      },
    }
    const runState = ref<ReplState>({ status: 'running', config: runConfig, output: emptyOutput() })
    const frame = shallowRef<ReturnType<typeof createReplDomFrame>>()
    let terminateWorker: (() => void) | undefined
    let canceled = false

    activeRun.value = {
      state: runState,
      frame,
      cancel: () => {
        canceled = true
        terminateWorker?.()
        frame.value?.dispose()
      },
    }
    const onProgress = (event: ReplProgressEvent) => {
      const output = runState.value.output
      switch (event.type) {
        case 'console-clear':
          output.logs = []
          break
        case 'console':
          output.logs.push(event.entry)
          break
        case 'timing':
          output.markers[event.index] = event.marker
          break
      }
    }

    try {
      // Compilation and Vue's DOM update must finish before a runtime can be created.
      const [code] = await Promise.all([
        compile.whenEnabled({ code: runConfig.test.code }),
        nextTick(),
      ])
      if (canceled) return
      let result

      if (runConfig.runtime === 'dom') {
        const host = previewHost.value
        if (!host) throw new Error('The DOM preview is unavailable.')
        frame.value = createReplDomFrame(
          host,
          {
            code,
            colorMode: previewColorMode.value,
            dependencies: runConfig.test.dependencies,
            setupHtml: runConfig.setupHtml,
          },
          onProgress,
          REPL_TIMEOUT_MS
        )
        result = await frame.value.result
      } else {
        const worker = useWebWorkerFn(runReplCode, {
          dependencies: runConfig.test.dependencies,
          esm: runConfig.test.dependencies.some((dependency) => dependency.esm),
          onProgress,
          timeout: REPL_TIMEOUT_MS,
        })
        terminateWorker = worker.workerTerminate
        result = await worker.workerFn({ code })
      }

      runState.value = {
        status: 'success',
        config: runConfig,
        output: { ...runState.value.output, ...result },
      }
    } catch (error) {
      if (canceled) return
      const normalizedError = normalizeError(error)
      console.error(
        `${runConfig.runtime === 'dom' ? 'DOM frame' : 'Worker'} failed:`,
        normalizedError
      )
      runState.value = {
        status: 'error',
        config: runConfig,
        output: runState.value.output,
        error: normalizedError,
      }
      if (normalizedError.message.toLowerCase().startsWith('unexpected')) {
        usePredefinedNotifications().typescriptHint()
      }
    } finally {
      terminateWorker?.()
      terminateWorker = undefined
    }
  }

  watch(() => config.value.runtime, reset)

  onScopeDispose(() => {
    disposed = true
    reset()
  })

  return {
    hasDomPreview: computed(() => {
      const frame = activeRun.value?.frame.value
      return !!frame && !frame.isDisposed.value
    }),
    isRunning: computed(() => state.value.status === 'running'),
    reset,
    run,
    state,
  }
}
