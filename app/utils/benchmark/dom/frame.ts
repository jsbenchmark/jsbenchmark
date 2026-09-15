import { runBenchmark } from '../run'
import type { BenchmarkRunOptions, BenchmarkRunResult } from '../run'
import { serializeBenchmarkError } from './protocol'
import type { DomRunPayload } from './protocol'

type ScriptElementLike = {
  src: string
  onload?: () => void
  onerror?: () => void
}

type FrameDocumentLike = {
  body: { innerHTML: string }
  head: { append: (element: ScriptElementLike) => void }
  createElement: (tagName: string) => ScriptElementLike
}

type BenchmarkFunction = (options: BenchmarkRunOptions) => Promise<BenchmarkRunResult>
type ModuleImporter = (url: string) => Promise<Record<string, unknown>>

export async function executeDomFramePayload(
  payload: DomRunPayload,
  benchmark: BenchmarkFunction,
  documentObject: FrameDocumentLike = document as unknown as FrameDocumentLike,
  globalObject: Record<string, unknown> = globalThis,
  importModule: ModuleImporter = (url) => Function('url', 'return import(url)')(url)
) {
  const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'

  documentObject.body.innerHTML = payload.setupHtml

  for (const [index, dependency] of payload.dependencies.entries()) {
    if (dependency.esm) {
      try {
        const namespace = await importModule(dependency.url)
        const name = dependency.name || `DEP_${index}`

        globalObject[name] =
          Object.keys(namespace).length === 1 && namespace.default ? namespace.default : namespace
      } catch (error) {
        throw new Error(`Failed to load ESM dependency "${dependency.url}": ${errorMessage(error)}`)
      }

      continue
    }

    await new Promise<void>((resolve, reject) => {
      const script = documentObject.createElement('script')
      script.src = dependency.url
      script.onload = resolve
      script.onerror = () =>
        reject(new Error(`Failed to load classic dependency "${dependency.url}"`))

      documentObject.head.append(script)
    })
  }

  return benchmark(payload.options)
}

type FrameWindowLike = {
  parent: { postMessage: (message: unknown, targetOrigin: string) => void }
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void
  removeEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void
}

export function domFrameBootstrap(
  executePayload: typeof executeDomFramePayload,
  benchmark: typeof runBenchmark,
  serializeError: typeof serializeBenchmarkError,
  frameWindow: FrameWindowLike = window,
  documentObject: FrameDocumentLike = document as unknown as FrameDocumentLike,
  globalObject: Record<string, unknown> = globalThis
) {
  const receiveJob = (event: MessageEvent<{ type: 'run'; payload: DomRunPayload }>) => {
    if (
      event.source !== frameWindow.parent ||
      event.data?.type !== 'run' ||
      event.ports.length !== 1
    ) {
      return
    }

    frameWindow.removeEventListener('message', receiveJob)
    const port = event.ports[0]!

    void executePayload(event.data.payload, benchmark, documentObject, globalObject)
      .then((result) => port.postMessage({ type: 'result', result }))
      .catch((error) => port.postMessage({ type: 'error', error: serializeError(error) }))
      .finally(() => port.close())
  }

  frameWindow.addEventListener('message', receiveJob)
  frameWindow.parent.postMessage({ type: 'ready' }, '*')
}

export const createDomFrameSrcdoc = () => `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Benchmark case</title></head>
  <body>
    <script>(${domFrameBootstrap.toString()})(
      ${executeDomFramePayload.toString()},
      ${runBenchmark.toString()},
      ${serializeBenchmarkError.toString()}
    )<\/script>
  </body>
</html>`
