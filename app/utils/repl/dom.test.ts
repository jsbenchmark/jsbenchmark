import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createReplFrameSrcdoc, createReplDomFrame } from './dom'
import { createSandboxHarness } from '../../../tests/helpers/sandbox-frame'

const payload = {
  code: "console.log(document.querySelector('#target'))",
  colorMode: 'dark' as const,
  dependencies: [{ url: '/classic.js' }, { url: '/module.js', name: 'LIB', esm: true }],
  setupHtml: '<button id="target">Run</button>',
}

describe('createReplDomFrame disposal', () => {
  const frame = { setAttribute: vi.fn(), remove: vi.fn() }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal('document', { createElement: () => frame })
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout,
      clearTimeout,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const createJob = () =>
    createReplDomFrame({ replaceChildren: vi.fn() } as unknown as HTMLElement, payload, vi.fn())

  it('removes the preview when execution times out', async () => {
    const job = createJob()
    const rejection = expect(job.result).rejects.toThrow('timeout')

    await vi.advanceTimersByTimeAsync(30_000)
    await rejection

    expect(job.isDisposed.value).toBe(true)
    expect(frame.remove).toHaveBeenCalledOnce()
  })

  it('settles a canceled run and releases its frame and watchdog once', async () => {
    const job = createJob()

    job.dispose()
    job.dispose()

    await expect(job.result).rejects.toMatchObject({ name: 'AbortError' })
    expect(job.isDisposed.value).toBe(true)
    expect(frame.remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('REPL frame harness', () => {
  it('executes code with the HTML fixture and returns its result and timings', async () => {
    const frame = createSandboxHarness(createReplFrameSrcdoc())

    await frame.send({
      ...payload,
      dependencies: [{ url: '/classic.js' }],
      code: "TIME('render', () => 42); return document.body.innerHTML",
    })

    expect(frame.port.postMessage).toHaveBeenCalledWith({
      type: 'result',
      result: expect.objectContaining({
        value: payload.setupHtml,
        markers: [expect.objectContaining({ name: 'render', duration: expect.any(Number) })],
      }),
    })
    expect(frame.document.documentElement.style.colorScheme).toBe('dark')
  })

  it('returns execution errors', async () => {
    const frame = createSandboxHarness(createReplFrameSrcdoc())

    await frame.send({ ...payload, dependencies: [], code: "throw new TypeError('broken')" })

    expect(frame.port.postMessage).toHaveBeenCalledWith({
      type: 'error',
      error: expect.objectContaining({ name: 'TypeError', message: 'broken' }),
    })
  })

  it('accepts only its parent and preserves console output after completion', async () => {
    const frame = createSandboxHarness(createReplFrameSrcdoc())
    const input = {
      ...payload,
      dependencies: [],
      code: "document.onclick = () => console.log('clicked'); return 42",
    }

    expect(frame.parent.postMessage).toHaveBeenCalledWith({ type: 'ready' }, '*')

    await frame.send(input, {})
    await frame.send(input, frame.parent, [])
    await frame.send(input, frame.parent, [frame.port, frame.port])

    expect(frame.port.postMessage).not.toHaveBeenCalled()

    await frame.send(input)
    await frame.send(input)

    expect(frame.port.postMessage).toHaveBeenCalledOnce()

    Reflect.get(frame.document, 'onclick')()

    expect(frame.port.postMessage).toHaveBeenLastCalledWith({
      type: 'progress',
      event: {
        type: 'console',
        entry: { level: 'log', values: ['clicked'], time: expect.any(Number) },
      },
    })
    expect(frame.port.close).not.toHaveBeenCalled()
  })
})
