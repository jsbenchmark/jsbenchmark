import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDomFrameJob,
  registerDomRunnerClosingHandlers,
} from '../../app/utils/benchmark/dom/runner'

const payload = {
  caseName: 'DOM case',
  dependencies: [],
  options: {
    async: false,
    code: 'DATA.value++',
    dataCode: 'return { value: 0 }',
    targetBatchTime: 40,
    time: 1_000,
    warmupTime: 250,
  },
  setupHtml: '<button id="target">Run</button>',
}
const measurement = {
  batchSize: 2,
  elapsedMs: 10,
  iterations: 4,
  samplesMsPerOperation: [2.5, 2.5],
}

const listeners = new Set<(event: MessageEvent) => void>()
const ports: MessagePort[] = []
const jobs: ReturnType<typeof createDomFrameJob>[] = []

const frameElement = () => ({
  contentWindow: { postMessage: vi.fn() },
  setAttribute: vi.fn(),
  remove: vi.fn(),
  title: '',
  className: '',
  srcdoc: '',
})
const emitReady = (source: unknown, data: unknown = { type: 'ready' }) => {
  for (const receive of listeners) receive({ source, data } as MessageEvent)
}
const createJob = (fixture = payload.setupHtml) => {
  const job = createDomFrameJob({ ...payload, setupHtml: fixture }, 3_250)
  jobs.push(job)
  return { job, frame: job.frame as unknown as ReturnType<typeof frameElement> }
}
const connect = (frame: ReturnType<typeof frameElement>) => {
  emitReady(frame.contentWindow)
  const port = frame.contentWindow.postMessage.mock.calls[0]![2][0] as MessagePort
  ports.push(port)
  return port
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('document', { createElement: vi.fn(frameElement) })
  vi.stubGlobal('window', {
    addEventListener: (_type: string, receive: (event: MessageEvent) => void) =>
      listeners.add(receive),
    removeEventListener: (_type: string, receive: (event: MessageEvent) => void) =>
      listeners.delete(receive),
    setTimeout,
    clearTimeout,
  })
})

afterEach(() => {
  for (const job of jobs) job.cancel()
  for (const port of ports) port.close()
  jobs.length = 0
  ports.length = 0
  listeners.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('createDomFrameJob', () => {
  it('keeps the fixture out of srcdoc and sends it with one port only to its own frame', async () => {
    const fixture = '<script>window.bad = true</script>'
    const { job, frame } = createJob(fixture)
    const result = expect(job.result).resolves.toEqual(measurement)

    expect(frame.setAttribute).toHaveBeenCalledWith('sandbox', 'allow-scripts')
    expect(frame.srcdoc).not.toContain(fixture)
    expect(frame.className).not.toContain('hidden')

    emitReady({})
    emitReady(frame.contentWindow, { type: 'unrelated' })
    expect(frame.contentWindow.postMessage).not.toHaveBeenCalled()

    const port = connect(frame)
    emitReady(frame.contentWindow)
    expect(frame.contentWindow.postMessage).toHaveBeenCalledExactlyOnceWith(
      { type: 'run', payload: { ...payload, setupHtml: fixture } },
      '*',
      [port]
    )
    expect(listeners.size).toBe(0)
    port.postMessage({ type: 'result', result: measurement })
    await result
    expect(frame.remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    job.cancel()
    expect(frame.remove).toHaveBeenCalledOnce()
  })

  it('gives concurrent jobs independent frames and ports for out-of-order completion', async () => {
    const first = createJob('<p>first</p>')
    const second = createJob('<p>second</p>')
    expect(first.frame).not.toBe(second.frame)
    const firstResult = expect(first.job.result).resolves.toEqual(measurement)
    const secondResult = expect(second.job.result).resolves.toEqual({
      ...measurement,
      iterations: 8,
    })
    const firstPort = connect(first.frame)
    const secondPort = connect(second.frame)

    secondPort.postMessage({ type: 'result', result: { ...measurement, iterations: 8 } })
    await secondResult
    expect(first.frame.remove).not.toHaveBeenCalled()
    firstPort.postMessage({ type: 'result', result: measurement })
    await firstResult
    expect(first.frame.remove).toHaveBeenCalledOnce()
    expect(second.frame.remove).toHaveBeenCalledOnce()
  })

  it('rejects malformed sandbox responses and removes the frame', async () => {
    const { job, frame } = createJob()
    const result = expect(job.result).rejects.toThrow('invalid response')
    connect(frame).postMessage({ type: 'result', result: {} })
    await result
    expect(frame.remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves errors returned by a frame', async () => {
    const { job, frame } = createJob()
    const result = expect(job.result).rejects.toMatchObject({
      name: 'TypeError',
      message: 'setup failed',
      stack: 'original stack',
    })
    connect(frame).postMessage({
      type: 'error',
      error: { name: 'TypeError', message: 'setup failed', stack: 'original stack' },
    })
    await result
    expect(frame.remove).toHaveBeenCalledOnce()
  })

  it.each([false, true])('cleans up a timed-out frame (connected: %s)', async (connected) => {
    const { job, frame } = createJob()
    const result = expect(job.result).rejects.toThrow("doesn't take longer than 3.25 seconds")
    if (connected) connect(frame)
    await vi.advanceTimersByTimeAsync(3_250)
    await result
    expect(frame.remove).toHaveBeenCalledOnce()
    expect(listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels every active frame without leaving listeners or timers', async () => {
    const first = createJob()
    const second = createJob()
    const firstResult = expect(first.job.result).rejects.toThrow('frame was closed')
    const secondResult = expect(second.job.result).rejects.toThrow('frame was closed')
    connect(first.frame)

    first.job.cancel()
    second.job.cancel()
    await Promise.all([firstResult, secondResult])
    expect(first.frame.remove).toHaveBeenCalledOnce()
    expect(second.frame.remove).toHaveBeenCalledOnce()
    expect(listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('registerDomRunnerClosingHandlers', () => {
  it('reports pagehide or beforeunload once and removes both listeners on cleanup', () => {
    const listeners = new Map<string, Set<() => void>>()
    const windowObject = {
      addEventListener: vi.fn((type: string, listener: () => void) => {
        const entries = listeners.get(type) ?? new Set()
        entries.add(listener)
        listeners.set(type, entries)
      }),
      removeEventListener: vi.fn((type: string, listener: () => void) => {
        listeners.get(type)?.delete(listener)
      }),
    }
    const reportClosing = vi.fn()
    const stop = registerDomRunnerClosingHandlers(windowObject, reportClosing)

    for (const listener of listeners.get('pagehide') ?? []) listener()
    for (const listener of listeners.get('beforeunload') ?? []) listener()
    expect(reportClosing).toHaveBeenCalledOnce()

    stop()
    for (const listener of listeners.get('pagehide') ?? []) listener()
    expect(reportClosing).toHaveBeenCalledOnce()
  })
})
