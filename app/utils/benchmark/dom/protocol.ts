import type { PreparedBenchmarkCase } from '../execution'
import type { BenchmarkRunResult } from '../run'

const DOM_SESSION_FRAGMENT_PREFIX = 'jsbenchmark-dom-'

export const createDomChannelName = (sessionId: string) => `jsbenchmark:dom:${sessionId}`

export const createDomSessionFragment = (sessionId: string) =>
  `${DOM_SESSION_FRAGMENT_PREFIX}${sessionId}`

export const parseDomSessionFragment = (fragment: string) => {
  if (!fragment.startsWith(DOM_SESSION_FRAGMENT_PREFIX)) return

  const sessionId = fragment.slice(DOM_SESSION_FRAGMENT_PREFIX.length)
  return /^[A-Za-z0-9_-]{8,128}$/.test(sessionId) ? sessionId : undefined
}

export type SerializedBenchmarkError = {
  name: string
  message: string
  stack?: string
}

export type DomRunPayload = PreparedBenchmarkCase & {
  setupHtml: string
}

// The random channel name scopes these messages to one session. Both endpoints are app code.
export type ParentToRunnerMessage =
  | {
      type: 'run'
      requestId: string
      responseTimeoutMs: number
      payload: DomRunPayload
    }
  | { type: 'close' }

export type RunnerToParentMessage =
  | { type: 'ready' }
  | { type: 'result'; requestId: string; result: BenchmarkRunResult }
  | { type: 'error'; requestId: string; error: SerializedBenchmarkError }
  | { type: 'visibility'; hidden: boolean }
  | { type: 'closing' }

export type FrameToRunnerMessage =
  | { type: 'result'; result: BenchmarkRunResult }
  | { type: 'error'; error: SerializedBenchmarkError }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// Check output once, where it leaves the sandbox that runs user code.
export const isFrameToRunnerMessage = (value: unknown): value is FrameToRunnerMessage => {
  if (!isRecord(value)) return false

  if (value.type === 'result' && isRecord(value.result)) {
    const { batchSize, elapsedMs, iterations, samplesMsPerOperation } = value.result

    return (
      typeof batchSize === 'number' &&
      Number.isFinite(batchSize) &&
      batchSize > 0 &&
      typeof elapsedMs === 'number' &&
      Number.isFinite(elapsedMs) &&
      elapsedMs >= 0 &&
      typeof iterations === 'number' &&
      Number.isFinite(iterations) &&
      iterations > 0 &&
      Array.isArray(samplesMsPerOperation) &&
      samplesMsPerOperation.every(Number.isFinite)
    )
  }

  if (value.type === 'error' && isRecord(value.error)) {
    const { name, message, stack } = value.error

    return (
      typeof name === 'string' &&
      typeof message === 'string' &&
      (stack === undefined || typeof stack === 'string')
    )
  }

  return false
}

export function serializeBenchmarkError(error: unknown): SerializedBenchmarkError {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      ...(error.stack ? { stack: error.stack } : {}),
    }
  }

  return { name: 'Error', message: typeof error === 'string' ? error : 'Unknown error' }
}

export const deserializeBenchmarkError = (error: SerializedBenchmarkError) => {
  const deserialized = new Error(error.message)
  deserialized.name = error.name
  if (error.stack) deserialized.stack = error.stack

  return deserialized
}
