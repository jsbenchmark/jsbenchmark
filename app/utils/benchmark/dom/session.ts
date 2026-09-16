import { deserializeSandboxError } from '../../sandbox'
import { nanoid } from 'nanoid'
import { createBenchmarkTimeoutError } from '../execution'
import type { BenchmarkRunResult } from '../run'
import { createDomChannelName, createDomSessionFragment } from './protocol'
import type { DomRunPayload, ParentToRunnerMessage, RunnerToParentMessage } from './protocol'

const READY_TIMEOUT_MS = 3_000
const RUNNER_RESPONSE_GRACE_MS = 500
const RUNNER_OPEN_ERROR = 'The DOM runner did not open. Allow popups for this site and try again.'

type SessionWindow = {
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void
  location: { href: string }
  open: (url?: string | URL, target?: string, features?: string) => Window | null
  setTimeout: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>
}

type PendingRequest = {
  reject: (error: Error) => void
  resolve: (result: BenchmarkRunResult) => void
  timeout: ReturnType<typeof setTimeout>
}

export type DomBenchmarkSession = {
  close: () => void
  ready: Promise<void>
  run: (
    payload: DomRunPayload,
    timeoutMs: number,
    responseTimeoutMs?: number
  ) => Promise<BenchmarkRunResult>
}

export type DomBenchmarkSessionOptions = {
  BroadcastChannel?: typeof BroadcastChannel
  createId?: () => string
  onVisibilityChange?: (hidden: boolean) => void
  readyTimeoutMs?: number
  window?: SessionWindow
}

export function createDomBenchmarkSession(
  options: DomBenchmarkSessionOptions = {}
): DomBenchmarkSession {
  const windowObject = options.window ?? (window as unknown as SessionWindow)
  const BroadcastChannelConstructor = options.BroadcastChannel ?? BroadcastChannel
  const createId = options.createId ?? nanoid
  const sessionId = createId()
  const channel = new BroadcastChannelConstructor(createDomChannelName(sessionId))

  let isClosed = false
  let isReady = false
  let latestHidden = false
  const pending = new Map<string, PendingRequest>()
  let rejectReady!: (error: Error) => void
  let resolveReady!: () => void
  let readyTimeout: ReturnType<typeof setTimeout> | undefined

  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  const clearReadyTimeout = () => {
    if (readyTimeout !== undefined) windowObject.clearTimeout(readyTimeout)
    readyTimeout = undefined
  }

  const terminate = (error: Error, notifyRunner = false) => {
    if (isClosed) return

    if (notifyRunner && isReady) {
      channel.postMessage({ type: 'close' } satisfies ParentToRunnerMessage)
    }

    isClosed = true
    clearReadyTimeout()
    if (!isReady) rejectReady(error)

    for (const request of pending.values()) {
      windowObject.clearTimeout(request.timeout)
      request.reject(error)
    }

    pending.clear()
    options.onVisibilityChange?.(false)
    channel.close()
  }

  readyTimeout = windowObject.setTimeout(
    () => terminate(new Error(RUNNER_OPEN_ERROR)),
    options.readyTimeoutMs ?? READY_TIMEOUT_MS
  )

  channel.onmessage = (event: MessageEvent<RunnerToParentMessage>) => {
    if (isClosed) return

    const message = event.data

    if (message?.type === 'ready') {
      if (isReady) return
      isReady = true
      clearReadyTimeout()
      resolveReady()
      return
    }

    if (message?.type === 'visibility') {
      latestHidden = message.hidden
      if (pending.size > 0) {
        options.onVisibilityChange?.(message.hidden)
      }
      return
    }

    if (message?.type === 'closing') {
      const error = !isReady
        ? new Error('The DOM runner closed before it was ready.')
        : pending.size > 0
          ? new Error('The DOM runner closed before the test finished.')
          : new Error('The DOM runner closed.')
      terminate(error)
      return
    }

    if (message?.type !== 'result' && message?.type !== 'error') return

    const request = pending.get(message.requestId)
    if (!request) return

    pending.delete(message.requestId)
    windowObject.clearTimeout(request.timeout)

    if (message.type === 'result') {
      request.resolve(message.result)
    } else {
      request.reject(deserializeSandboxError(message.error))
    }
  }

  const runnerUrl = new URL('/runner', windowObject.location.href)
  runnerUrl.hash = createDomSessionFragment(sessionId)

  try {
    windowObject.open(
      runnerUrl.href,
      '_blank',
      'noopener,popup,width=960,height=720,resizable=yes,scrollbars=yes'
    )
  } catch {
    terminate(new Error(RUNNER_OPEN_ERROR))
  }

  const startRequest = (
    payload: DomRunPayload,
    timeoutMs: number,
    responseTimeoutMs = timeoutMs
  ) => {
    if (isClosed) return Promise.reject(new Error('The DOM runner session is closed.'))

    const requestId = createId()

    return new Promise<BenchmarkRunResult>((resolve, reject) => {
      const timeout = windowObject.setTimeout(
        () => terminate(createBenchmarkTimeoutError(timeoutMs)),
        responseTimeoutMs + RUNNER_RESPONSE_GRACE_MS
      )

      pending.set(requestId, { reject, resolve, timeout })
      options.onVisibilityChange?.(latestHidden)

      channel.postMessage({
        type: 'run',
        requestId,
        responseTimeoutMs,
        payload,
      } satisfies ParentToRunnerMessage)
    })
  }

  const run = (payload: DomRunPayload, timeoutMs: number, responseTimeoutMs = timeoutMs) =>
    isReady
      ? startRequest(payload, timeoutMs, responseTimeoutMs)
      : ready.then(() => startRequest(payload, timeoutMs, responseTimeoutMs))

  const close = () => {
    terminate(new Error('The DOM runner session was closed.'), true)
  }

  return { close, ready, run }
}
