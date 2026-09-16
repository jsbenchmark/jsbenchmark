import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWebWorkerFn } from './index'

class FakeWorker {
  static latest: FakeWorker | undefined

  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  terminate = vi.fn()

  constructor() {
    FakeWorker.latest = this
  }

  postMessage = vi.fn()
}

describe('useWebWorkerFn', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    FakeWorker.latest = undefined
  })

  it('rejects worker errors and can run again after failure', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { workerFn } = useWebWorkerFn(async () => 42, { window: globalThis as unknown as Window })

    const first = workerFn()
    FakeWorker.latest!.onmessage!(
      new MessageEvent('message', { data: ['ERROR', { reason: 'failed' }] })
    )
    await expect(first).rejects.toEqual({ reason: 'failed' })

    const second = workerFn()
    FakeWorker.latest!.onmessage!(new MessageEvent('message', { data: ['SUCCESS', 42] }))
    await expect(second).resolves.toBe(42)
  })

  it('releases resources if posting the input fails', async () => {
    class BrokenWorker extends FakeWorker {
      override postMessage = vi.fn(() => {
        throw new DOMException('Cannot clone input', 'DataCloneError')
      })
    }
    vi.stubGlobal('Worker', BrokenWorker)
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const { workerFn, workerStatus } = useWebWorkerFn(async () => 42, {
      window: globalThis as unknown as Window,
    })

    await expect(workerFn()).rejects.toMatchObject({ name: 'DataCloneError' })
    expect(FakeWorker.latest!.terminate).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledOnce()
    expect(workerStatus.value).toBe('ERROR')
  })

  it('settles an active run when explicitly terminated', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { workerFn, workerTerminate } = useWebWorkerFn(async () => 42, {
      window: globalThis as unknown as Window,
    })
    const pending = workerFn()

    workerTerminate()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeWorker.latest!.terminate).toHaveBeenCalledOnce()
  })

  it('forwards progress without settling the active worker promise', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const onProgress = vi.fn()
    const { workerFn } = useWebWorkerFn(async (value: string) => value, {
      onProgress,
      window: globalThis as unknown as Window,
    })

    let settled = false
    const result = workerFn('complete').finally(() => {
      settled = true
    })
    const worker = FakeWorker.latest!

    worker.onmessage?.(
      new MessageEvent('message', { data: ['PROGRESS', { type: 'console-clear' }] })
    )
    await Promise.resolve()

    expect(onProgress).toHaveBeenCalledWith({ type: 'console-clear' })
    expect(settled).toBe(false)
    expect(worker.terminate).not.toHaveBeenCalled()

    worker.onmessage?.(new MessageEvent('message', { data: ['SUCCESS', 'complete'] }))

    await expect(result).resolves.toBe('complete')
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
