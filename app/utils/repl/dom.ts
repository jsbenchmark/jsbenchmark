import { readonly, ref } from 'vue'
import { prepareSandbox, serializeSandboxError, deserializeSandboxError } from '../sandbox'
import type { SerializedSandboxError } from '../sandbox'
import { runReplCode } from './run'
import type { ReplProgressEvent, ReplRunPayload, ReplRunResult } from './types'

type ReplFrameMessage =
  | { type: 'progress'; event: ReplProgressEvent }
  | { type: 'result'; result: ReplRunResult }
  | { type: 'error'; error: SerializedSandboxError }

export function replFrameBootstrap(
  run: typeof runReplCode,
  prepare: typeof prepareSandbox,
  serializeError: typeof serializeSandboxError
) {
  const receiveRun = async (event: MessageEvent<{ type: 'run'; payload: ReplRunPayload }>) => {
    if (
      event.source !== window.parent ||
      event.data?.type !== 'run' ||
      !event.data.payload ||
      event.ports.length !== 1
    )
      return
    window.removeEventListener('message', receiveRun)
    const port = event.ports[0]!
    const payload = event.data.payload
    try {
      document.documentElement.style.colorScheme = payload.colorMode
      await prepare(payload)
      const result = await run({ code: payload.code }, (progress) =>
        port.postMessage({ type: 'progress', event: progress })
      )
      port.postMessage({ type: 'result', result })
    } catch (error) {
      port.postMessage({ type: 'error', error: serializeError(error) })
    }
    // Keep the port open for console output from preview interactions after completion.
  }
  window.addEventListener('message', receiveRun)
  window.parent.postMessage({ type: 'ready' }, '*')
}

export const createReplFrameSrcdoc = () => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="light dark">
    <title>REPL preview</title>
    <style>
      :root { color-scheme: light dark; }
      html, body { min-height: 100%; background: Canvas; color: CanvasText; }
    </style>
  </head>
  <body>
    <script>(${replFrameBootstrap.toString()})(
      ${runReplCode.toString()},
      ${prepareSandbox.toString()},
      ${serializeSandboxError.toString()}
    )<\/script>
  </body>
</html>`

export function createReplDomFrame(
  host: HTMLElement,
  payload: ReplRunPayload,
  onProgress: (event: ReplProgressEvent) => void,
  timeoutMs = 30_000
) {
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.title = 'REPL DOM preview'
  frame.className = 'block h-full min-h-80 w-full border-0 bg-white dark:bg-gray-950'
  frame.srcdoc = createReplFrameSrcdoc()

  const isDisposed = ref(false)
  let dispose!: () => void

  const result = new Promise<ReplRunResult>((resolve, reject) => {
    let port: MessagePort | undefined
    let settled = false

    const finish = (complete: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      complete()
    }
    dispose = () => {
      if (isDisposed.value) return
      isDisposed.value = true
      window.removeEventListener('message', receiveReady)
      window.clearTimeout(timeout)
      port?.close()
      frame.remove()
      finish(() => reject(new DOMException('DOM execution canceled.', 'AbortError')))
    }

    const receiveReady = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.data?.type !== 'ready') return
      window.removeEventListener('message', receiveReady)

      const channel = new MessageChannel()
      port = channel.port1
      port.onmessage = ({ data }: MessageEvent<ReplFrameMessage>) => {
        if (data?.type === 'progress') {
          onProgress(data.event)
          return
        }
        if (data?.type === 'result') {
          finish(() => resolve(data.result))
          return
        }
        if (data?.type === 'error') {
          finish(() => reject(deserializeSandboxError(data.error)))
        }
      }
      port.start()
      frame.contentWindow?.postMessage({ type: 'run', payload }, '*', [channel.port2])
    }

    const timeout = window.setTimeout(
      () =>
        finish(() => {
          dispose()
          reject(
            new Error(
              `The code was stopped because it exceeded the ${timeoutMs / 1000}-second timeout.`
            )
          )
        }),
      timeoutMs
    )

    window.addEventListener('message', receiveReady)
    host.replaceChildren(frame)
  })

  return { dispose, frame, result, isDisposed: readonly(isDisposed) }
}
