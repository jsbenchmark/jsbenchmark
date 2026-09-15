import { createBenchmarkTimeoutError } from '../execution'
import type { BenchmarkRunResult } from '../run'
import { createDomFrameSrcdoc } from './frame'
import { deserializeBenchmarkError, isFrameToRunnerMessage } from './protocol'
import type { DomRunPayload } from './protocol'

export function createDomFrameJob(payload: DomRunPayload, responseTimeoutMs: number) {
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.title = payload.caseName ? `Benchmark: ${payload.caseName}` : 'Benchmark case'
  frame.className = 'absolute inset-0 block h-full min-h-0 w-full border-0 bg-white'
  frame.srcdoc = createDomFrameSrcdoc()

  const caseTimeoutMs = payload.options.time + payload.options.warmupTime + 2_000
  let cancel!: () => void

  const result = new Promise<BenchmarkRunResult>((resolve, reject) => {
    let port: MessagePort | undefined
    let settled = false

    const settle = (complete: () => void) => {
      if (settled) return
      settled = true

      window.removeEventListener('message', receiveFrameReady)
      window.clearTimeout(timeout)
      port?.close()
      frame.remove()

      complete()
    }

    cancel = () => settle(() => reject(new Error('The DOM benchmark frame was closed.')))

    const receiveFrameReady = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.data?.type !== 'ready') return

      window.removeEventListener('message', receiveFrameReady)

      const messageChannel = new MessageChannel()
      port = messageChannel.port1

      port.onmessage = ({ data }: MessageEvent<unknown>) => {
        if (!isFrameToRunnerMessage(data)) {
          settle(() => reject(new Error('The DOM benchmark frame returned an invalid response.')))
        } else if (data.type === 'result') {
          settle(() => resolve(data.result))
        } else {
          settle(() => reject(deserializeBenchmarkError(data.error)))
        }
      }

      frame.contentWindow!.postMessage({ type: 'run', payload }, '*', [messageChannel.port2])
    }

    const timeout = window.setTimeout(
      () => settle(() => reject(createBenchmarkTimeoutError(caseTimeoutMs))),
      responseTimeoutMs
    )

    window.addEventListener('message', receiveFrameReady)
  })

  return { cancel, frame, result }
}

export type DomFrameJob = ReturnType<typeof createDomFrameJob>

type RunnerWindowLifecycle = {
  addEventListener: (type: 'beforeunload' | 'pagehide', listener: () => void) => void
  removeEventListener: (type: 'beforeunload' | 'pagehide', listener: () => void) => void
}

export function registerDomRunnerClosingHandlers(
  windowObject: RunnerWindowLifecycle,
  reportClosing: () => void
) {
  let reported = false

  const reportOnce = () => {
    if (reported) return
    reported = true
    reportClosing()
  }

  windowObject.addEventListener('pagehide', reportOnce)
  windowObject.addEventListener('beforeunload', reportOnce)

  return () => {
    windowObject.removeEventListener('pagehide', reportOnce)
    windowObject.removeEventListener('beforeunload', reportOnce)
  }
}
