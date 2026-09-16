import { runBenchmark } from '../run'
import { prepareSandbox, serializeSandboxError } from '../../sandbox'
import type { DomRunPayload } from './protocol'

export function domFrameBootstrap(
  benchmark: typeof runBenchmark,
  prepare: typeof prepareSandbox,
  serializeError: typeof serializeSandboxError
) {
  const receiveJob = async (event: MessageEvent<{ type: 'run'; payload: DomRunPayload }>) => {
    if (event.source !== window.parent || event.data?.type !== 'run' || event.ports.length !== 1)
      return
    window.removeEventListener('message', receiveJob)
    const port = event.ports[0]!
    try {
      await prepare(event.data.payload)
      const result = await benchmark(event.data.payload.options)
      port.postMessage({ type: 'result', result })
    } catch (error) {
      port.postMessage({ type: 'error', error: serializeError(error) })
    } finally {
      port.close()
    }
  }
  window.addEventListener('message', receiveJob)
  window.parent.postMessage({ type: 'ready' }, '*')
}

export const createDomFrameSrcdoc = () => `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Benchmark case</title></head>
  <body>
    <script>(${domFrameBootstrap.toString()})(
      ${runBenchmark.toString()},
      ${prepareSandbox.toString()},
      ${serializeSandboxError.toString()}
    )<\/script>
  </body>
</html>`
