import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { createDefaultReplConfig } from '../../app/utils/repl/config'
import { useReplExecution } from '../../app/composables/repl-execution'
import type { UseWebWorkerOptions } from '../../app/utils/worker'
import type { ReplConfig, ReplProgressEvent, ReplRunResult } from '../../app/utils/repl/types'

const mocks = vi.hoisted(() => ({
  compile: vi.fn(async ({ code }: { code: string }) => `compiled:${code}`),
  createDomFrame: vi.fn(),
  workerStops: [] as Array<() => void>,
  workerOptions: undefined as UseWebWorkerOptions<ReplProgressEvent> | undefined,
  workerFn: vi.fn(),
}))

vi.mock('../../app/composables/compile', () => ({
  useCompile: () => ({ whenEnabled: mocks.compile }),
}))

vi.mock('../../app/utils/worker', () => ({
  useWebWorkerFn: (_run: unknown, options: typeof mocks.workerOptions) => {
    mocks.workerOptions = options
    const workerTerminate = vi.fn()
    mocks.workerStops.push(workerTerminate)

    return { workerFn: mocks.workerFn, workerTerminate }
  },
}))

vi.mock('../../app/utils/repl/dom', () => ({
  createReplDomFrame: mocks.createDomFrame,
}))

afterEach(() => {
  vi.clearAllMocks()
  mocks.workerOptions = undefined
  mocks.workerStops = []
})

function createExecution(runtime: ReplConfig['runtime'] = 'worker') {
  const config = ref(createDefaultReplConfig())
  config.value.runtime = runtime
  const host = ref({} as HTMLElement)
  const scope = effectScope()
  const execution = scope.run(() => useReplExecution(config, host, ref('dark')))!

  onTestFinished(() => scope.stop())

  return { config, host, scope, execution }
}

describe('useReplExecution', () => {
  it('ignores an old run after cancellation without stopping its replacement', async () => {
    const oldResult = Promise.withResolvers<ReplRunResult>()
    const newResult = Promise.withResolvers<ReplRunResult>()
    mocks.workerFn.mockReturnValueOnce(oldResult.promise).mockReturnValueOnce(newResult.promise)
    const { execution } = createExecution()

    const oldRun = execution.run()
    await vi.waitFor(() => expect(mocks.workerFn).toHaveBeenCalledTimes(1))
    const oldProgress = mocks.workerOptions!.onProgress!

    execution.reset()
    const newRun = execution.run()
    await vi.waitFor(() => expect(mocks.workerFn).toHaveBeenCalledTimes(2))

    oldProgress({ type: 'console', entry: { level: 'log', time: 0, values: ['stale'] } })
    oldResult.resolve({ duration: 9, markers: [], value: 'old' })
    await oldRun

    expect(execution.state.value).toMatchObject({ status: 'running', output: { logs: [] } })
    expect(mocks.workerStops[1]).not.toHaveBeenCalled()

    newResult.resolve({ duration: 1, markers: [], value: 'new' })
    await newRun

    expect(execution.state.value.output).toMatchObject({ value: 'new', logs: [] })
  })

  it('updates a streamed timing in place before execution finishes', async () => {
    const result = Promise.withResolvers<ReplRunResult>()
    mocks.workerFn.mockReturnValueOnce(result.promise)
    const { execution } = createExecution()

    const pending = execution.run()
    await vi.waitFor(() => expect(mocks.workerOptions).toBeDefined())
    const progress = mocks.workerOptions!.onProgress!

    progress({ type: 'timing', index: 0, marker: { name: 'work', time: 1 } })
    progress({ type: 'timing', index: 0, marker: { name: 'work', time: 1, duration: 2 } })

    expect(execution.state.value.output.markers).toEqual([{ name: 'work', time: 1, duration: 2 }])

    result.resolve({ duration: 3, markers: [], value: 'done' })
    await pending
  })

  it('does not start execution when disposed during compilation', async () => {
    const compilation = Promise.withResolvers<string>()
    mocks.compile.mockReturnValueOnce(compilation.promise)
    const { scope, execution } = createExecution()

    const pending = execution.run()
    scope.stop()
    compilation.resolve('return 42')
    await pending

    expect(mocks.workerFn).not.toHaveBeenCalled()
    expect(mocks.createDomFrame).not.toHaveBeenCalled()
    expect(execution.state.value.status).toBe('idle')
  })

  it('keeps the executed configuration when the editor is changed', async () => {
    mocks.workerFn.mockResolvedValueOnce({ duration: 1, markers: [], value: '1' })
    const { config, execution } = createExecution()
    config.value.test.code = 'return 1'
    config.value.test.dependencies = [{ url: '/original.js' }]

    await execution.run()

    config.value.test.code = 'return 2'
    config.value.test.dependencies[0]!.url = '/edited.js'

    expect(execution.state.value).toMatchObject({
      status: 'success',
      config: { test: { code: 'return 1', dependencies: [{ url: '/original.js' }] } },
    })
  })

  it('streams Worker output and completes with the returned value', async () => {
    mocks.workerFn.mockImplementation(async () => {
      mocks.workerOptions?.onProgress?.({
        type: 'console',
        entry: { level: 'log', time: 1, values: ['first'] },
      })
      mocks.workerOptions?.onProgress?.({ type: 'console-clear' })
      mocks.workerOptions?.onProgress?.({
        type: 'console',
        entry: { level: 'info', time: 2, values: ['kept'] },
      })

      return {
        duration: 4,
        markers: [{ name: 'work', time: 0, duration: 3 }],
        value: '42',
      }
    })
    const { config, execution } = createExecution()
    config.value.test.dependencies = [{ url: '/lib.js', esm: true }]

    await execution.run()

    expect(mocks.workerFn).toHaveBeenCalledWith({ code: `compiled:${config.value.test.code}` })
    expect(mocks.workerOptions).toMatchObject({
      dependencies: [{ url: '/lib.js', esm: true }],
      esm: true,
    })
    expect(execution.state.value).toMatchObject({
      status: 'success',
      output: {
        duration: 4,
        value: '42',
        logs: [{ level: 'info', time: 2, values: ['kept'] }],
        markers: [{ name: 'work', time: 0, duration: 3 }],
      },
    })
  })

  it('runs DOM code in the preview host and keeps the frame after completion', async () => {
    const dispose = vi.fn()
    mocks.createDomFrame.mockReturnValue({
      isDisposed: ref(false),
      dispose,
      frame: {},
      result: Promise.resolve({ duration: 2, markers: [], value: '<button>Done</button>' }),
    })
    const { config, host, scope, execution } = createExecution('dom')
    config.value.setupHtml = '<button>Run</button>'

    await execution.run()

    expect(mocks.createDomFrame).toHaveBeenCalledWith(
      host.value,
      expect.objectContaining({
        code: `compiled:${config.value.test.code}`,
        colorMode: 'dark',
        setupHtml: '<button>Run</button>',
      }),
      expect.any(Function),
      30_000
    )
    expect(execution.hasDomPreview.value).toBe(true)
    expect(execution.state.value.status).toBe('success')
    expect(dispose).not.toHaveBeenCalled()

    scope.stop()

    expect(dispose).toHaveBeenCalledOnce()
  })
})
