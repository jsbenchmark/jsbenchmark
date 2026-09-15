import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { serializeBenchmarkError } from '../../app/utils/benchmark/dom/protocol'
import {
  createDomFrameSrcdoc,
  domFrameBootstrap,
  executeDomFramePayload,
} from '../../app/utils/benchmark/dom/frame'

const payload = {
  caseName: 'DOM case',
  dependencies: [{ url: '/first.js' }, { url: '/second.js', name: 'LIB', esm: true }],
  options: {
    async: false,
    code: 'DATA.element.toggleAttribute("data-active")',
    dataCode: 'return { element: document.querySelector("#target") }',
    targetBatchTime: 40,
    time: 1_000,
    warmupTime: 250,
  },
  setupHtml: '<button id="target">Run</button>',
}

describe('executeDomFramePayload', () => {
  it('installs the fixture, loads dependencies in order, then starts the benchmark', async () => {
    const events: string[] = []
    const scripts: Array<{ src: string; onload?: () => void; onerror?: () => void }> = []
    const documentObject = {
      body: {
        set innerHTML(value: string) {
          events.push(`fixture:${value}`)
        },
      },
      createElement: vi.fn(() => {
        const script = { src: '', onload: undefined, onerror: undefined }
        scripts.push(script)
        return script
      }),
      head: {
        append: vi.fn((script: (typeof scripts)[number]) => {
          events.push(`classic:${script.src}`)
          script.onload?.()
        }),
      },
    }
    const globalObject: Record<string, unknown> = {}
    const importModule = vi.fn(async (url: string) => {
      events.push(`esm:${url}`)
      return { default: { version: 1 } }
    })
    const benchmark = vi.fn(async () => {
      events.push('benchmark')
      return { batchSize: 1, elapsedMs: 1, iterations: 1, samplesMsPerOperation: [1] }
    })

    const result = await executeDomFramePayload(
      payload,
      benchmark,
      documentObject,
      globalObject,
      importModule
    )

    expect(events).toEqual([
      `fixture:${payload.setupHtml}`,
      'classic:/first.js',
      'esm:/second.js',
      'benchmark',
    ])
    expect(globalObject.LIB).toEqual({ version: 1 })
    expect(benchmark).toHaveBeenCalledWith(payload.options)
    expect(result.elapsedMs).toBe(1)
  })

  it('assigns a deterministic fallback name to ESM dependencies', async () => {
    const globalObject: Record<string, unknown> = {}
    const moduleNamespace = { named: true }

    await executeDomFramePayload(
      { ...payload, dependencies: [{ url: '/module.js', esm: true }] },
      async () => ({ batchSize: 1, elapsedMs: 1, iterations: 1, samplesMsPerOperation: [1] }),
      { body: { innerHTML: '' }, head: {}, createElement: vi.fn() },
      globalObject,
      async () => moduleNamespace
    )

    expect(globalObject.DEP_0).toBe(moduleNamespace)
  })

  it('reports useful classic and ESM dependency failures', async () => {
    const classicDocument = {
      body: { innerHTML: '' },
      createElement: vi.fn(() => ({ src: '', onload: undefined, onerror: undefined })),
      head: { append: (script: { onerror?: () => void }) => script.onerror?.() },
    }
    const benchmark = async () => ({
      batchSize: 1,
      elapsedMs: 1,
      iterations: 1,
      samplesMsPerOperation: [1],
    })

    await expect(
      executeDomFramePayload(
        { ...payload, dependencies: [{ url: '/bad.js' }] },
        benchmark,
        classicDocument,
        {},
        async () => ({})
      )
    ).rejects.toThrow('Failed to load classic dependency "/bad.js"')

    await expect(
      executeDomFramePayload(
        { ...payload, dependencies: [{ url: '/bad.mjs', esm: true }] },
        benchmark,
        { body: { innerHTML: '' }, head: {}, createElement: vi.fn() },
        {},
        async () => {
          throw new Error('network error')
        }
      )
    ).rejects.toThrow('Failed to load ESM dependency "/bad.mjs": network error')
  })
})

describe('createDomFrameSrcdoc', () => {
  it('contains only the trusted harness and never accepts user strings for interpolation', () => {
    const srcdoc = createDomFrameSrcdoc()

    expect(srcdoc).toContain('<!doctype html>')
    expect(srcdoc).toContain('domFrameBootstrap')
    expect(srcdoc).toContain('runBenchmark')
    expect(srcdoc).toContain('return import(url)')
    expect(srcdoc).not.toContain('__vite__injectQuery')
    expect(createDomFrameSrcdoc.length).toBe(0)
  })

  it('executes the serialized harness with a fixture and the shared benchmark engine', async () => {
    let receive: ((event: MessageEvent) => void) | undefined
    let elapsed = 0
    const parent = { postMessage: vi.fn() }
    const frameWindow = {
      parent,
      addEventListener: (_type: string, listener: typeof receive) => {
        receive = listener
      },
      removeEventListener: () => {
        receive = undefined
      },
    }
    const documentObject = { body: { innerHTML: '' } }
    const script = createDomFrameSrcdoc().match(/<script>([\s\S]*?)<\/script>/)![1]!
    runInNewContext(script, {
      window: frameWindow,
      document: documentObject,
      performance: { now: () => ++elapsed },
    })
    const { port1, port2 } = new MessageChannel()
    try {
      const response = new Promise((resolve) => {
        port1.onmessage = ({ data }) => resolve(data)
      })
      receive!({
        source: parent,
        ports: [port2],
        data: {
          type: 'run',
          payload: {
            dependencies: [],
            setupHtml: '<p>fixture</p>',
            options: {
              ...payload.options,
              code: 'if (DATA !== "<p>fixture</p>") throw new Error("Missing fixture")',
              dataCode: 'return document.body.innerHTML',
              time: 1,
              warmupTime: 0,
              targetBatchTime: 1,
            },
          },
        },
      } as unknown as MessageEvent)
      expect(await response).toEqual({
        type: 'result',
        result: { batchSize: 1, elapsedMs: 1, iterations: 1, samplesMsPerOperation: [1] },
      })
      expect(receive).toBeUndefined()
    } finally {
      port1.close()
      port2.close()
    }
  })
})

describe('domFrameBootstrap', () => {
  const createFrameHarness = () => {
    let receiveWindowMessage: ((event: MessageEvent) => void) | undefined
    const parent = { postMessage: vi.fn() }
    const frameWindow = {
      parent,
      addEventListener: vi.fn((_type: 'message', listener: (event: MessageEvent) => void) => {
        receiveWindowMessage = listener
      }),
      removeEventListener: vi.fn(() => {
        receiveWindowMessage = undefined
      }),
    }
    const port = {
      close: vi.fn(),
      postMessage: vi.fn(),
    }

    return {
      frameWindow,
      parent,
      port,
      receive: (event: Partial<MessageEvent>) => receiveWindowMessage?.(event as MessageEvent),
    }
  }

  it('accepts one MessagePort only from its parent and returns one terminal result', async () => {
    const harness = createFrameHarness()
    const result = { batchSize: 1, elapsedMs: 1, iterations: 1, samplesMsPerOperation: [1] }
    const executePayload = vi.fn(async () => result)

    domFrameBootstrap(executePayload, vi.fn(), vi.fn(), harness.frameWindow, {} as never, {})

    expect(harness.parent.postMessage).toHaveBeenCalledWith({ type: 'ready' }, '*')
    harness.receive({ data: { type: 'run', payload }, ports: [harness.port as never], source: {} })
    expect(harness.frameWindow.removeEventListener).not.toHaveBeenCalled()

    harness.receive({
      data: { type: 'run', payload },
      ports: [harness.port as never],
      source: harness.parent as never,
    })
    harness.receive({
      data: { type: 'run', payload },
      ports: [harness.port as never],
      source: harness.parent as never,
    })
    await vi.waitFor(() =>
      expect(harness.port.postMessage).toHaveBeenCalledWith({ type: 'result', result })
    )
    expect(executePayload).toHaveBeenCalledOnce()
    expect(harness.port.close).toHaveBeenCalledOnce()
  })

  it('returns execution failures through the transferred port and closes it', async () => {
    const harness = createFrameHarness()
    const executePayload = vi.fn(async () => {
      throw new TypeError('setup failed')
    })

    domFrameBootstrap(
      executePayload,
      vi.fn(),
      serializeBenchmarkError,
      harness.frameWindow,
      {} as never,
      {}
    )
    harness.receive({
      data: { type: 'run', payload },
      ports: [harness.port as never],
      source: harness.parent as never,
    })
    await vi.waitFor(() =>
      expect(harness.port.postMessage).toHaveBeenCalledWith({
        type: 'error',
        error: expect.objectContaining({ name: 'TypeError', message: 'setup failed' }),
      })
    )
    expect(harness.port.close).toHaveBeenCalledOnce()
  })
})
