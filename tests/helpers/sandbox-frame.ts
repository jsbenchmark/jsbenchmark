import { runInNewContext } from 'node:vm'
import { vi } from 'vitest'

export function createSandboxHarness(srcdoc: string, globals: Record<string, unknown> = {}) {
  let receive: ((event: MessageEvent) => Promise<void>) | undefined
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
  const port = { postMessage: vi.fn(), close: vi.fn() }
  const document = {
    documentElement: { style: { colorScheme: '' } },
    body: { innerHTML: '' },
    createElement: () => ({ src: '', onload: () => {} }),
    head: { append: (script: { onload: () => void }) => script.onload() },
  }

  const script = srcdoc.match(/<script>([\s\S]*?)<\/script>/)![1]!
  runInNewContext(script, {
    window: frameWindow,
    document,
    performance,
    console: { log() {} },
    ...globals,
  })

  const send = (payload: unknown, source: unknown = parent, ports: unknown[] = [port]) =>
    receive?.({ source, ports, data: { type: 'run', payload } } as MessageEvent)

  return { document, parent, port, send }
}
