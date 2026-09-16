import { describe, expect, it, vi } from 'vitest'
import {
  getBenchmarkWatchdogTimeout,
  normalizeBenchmarkExecutionError,
  runBenchmarkCases,
} from '../../app/utils/benchmark/execution'

describe('getBenchmarkWatchdogTimeout', () => {
  it('allows parallel DOM cases to queue on a shared renderer without changing other timeouts', () => {
    expect(getBenchmarkWatchdogTimeout('dom', true, 5_500, 3)).toBe(16_500)
    expect(getBenchmarkWatchdogTimeout('dom', false, 5_500, 3)).toBe(5_500)
    expect(getBenchmarkWatchdogTimeout('worker', true, 5_500, 3)).toBe(5_500)
  })
})

describe('runBenchmarkCases', () => {
  it('starts cases in parallel when requested', async () => {
    const resolvers: Array<() => void> = []
    const execute = vi.fn(() => new Promise<void>((resolve) => resolvers.push(resolve)))
    const promise = runBenchmarkCases(['a', 'b'], true, execute)

    expect(execute).toHaveBeenCalledTimes(2)

    resolvers.forEach((resolve) => resolve())
    await promise
  })

  it('runs cases sequentially in displayed order when parallel is disabled', async () => {
    const events: string[] = []
    const firstDone = Promise.withResolvers<void>()
    const promise = runBenchmarkCases(['a', 'b'], false, async (test, index) => {
      events.push(`start:${test}:${index}`)
      if (test === 'a') await firstDone.promise
      events.push(`end:${test}:${index}`)
    })

    await Promise.resolve()
    expect(events).toEqual(['start:a:0'])

    firstDone.resolve()
    await promise

    expect(events).toEqual(['start:a:0', 'end:a:0', 'start:b:1', 'end:b:1'])
  })
})

describe('normalizeBenchmarkExecutionError', () => {
  it('keeps Error instances and provides runtime-neutral timeout guidance', () => {
    const original = new TypeError('bad code')

    expect(normalizeBenchmarkExecutionError(original, 5_500)).toBe(original)

    const timeout = { type: 'TIMEOUT_EXPIRED' } as ErrorEvent
    expect(normalizeBenchmarkExecutionError(timeout, 5_500).message).toBe(
      "The test was canceled because the timeout expired. Check your code for infinite loops and make sure it doesn't take longer than 5.5 seconds."
    )
    expect(normalizeBenchmarkExecutionError({ type: 'error' } as ErrorEvent, 5_500).message).toBe(
      'error'
    )
    expect(normalizeBenchmarkExecutionError('bad', 5_500).message).toBe('Unknown error')
  })
})
