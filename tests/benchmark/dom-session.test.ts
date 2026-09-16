import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDomBenchmarkSession } from '../../app/utils/benchmark/dom/session'
import { createDomChannelName } from '../../app/utils/benchmark/dom/protocol'

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []

  closed = false
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  posted: unknown[] = []

  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.instances.push(this)
  }

  close() {
    this.closed = true
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent)
  }

  postMessage(data: unknown) {
    this.posted.push(data)
  }
}

const payload = {
  dependencies: [],
  options: {
    async: false,
    code: 'DATA.value++',
    dataCode: 'return { value: 0 }',
    targetBatchTime: 40,
    time: 1_000,
    warmupTime: 250,
  },
  setupHtml: '',
}

const measurement = {
  batchSize: 2,
  elapsedMs: 10,
  iterations: 4,
  samplesMsPerOperation: [2.5, 2.5],
}

const createSession = (overrides: Record<string, unknown> = {}) => {
  const open = vi.fn(() => null)
  const ids = ['session-a', 'request-a', 'request-b']
  const session = createDomBenchmarkSession({
    BroadcastChannel: FakeBroadcastChannel as unknown as typeof BroadcastChannel,
    createId: () => ids.shift()!,
    readyTimeoutMs: 100,
    window: {
      clearTimeout,
      location: { href: 'http://localhost:3000/benchmark' },
      open,
      setTimeout,
    },
    ...overrides,
  })

  return { channel: FakeBroadcastChannel.instances.at(-1)!, open, session }
}

afterEach(() => {
  FakeBroadcastChannel.instances = []
  vi.useRealTimers()
})

describe('createDomBenchmarkSession', () => {
  it('isolates sessions with real channels even when their request IDs match', async () => {
    const firstIds = ['session-first', 'shared-request']
    const secondIds = ['session-second', 'shared-request']
    const first = createSession({ BroadcastChannel, createId: () => firstIds.shift()! }).session
    const second = createSession({ BroadcastChannel, createId: () => secondIds.shift()! }).session
    const firstRunner = new BroadcastChannel(createDomChannelName('session-first'))
    const secondRunner = new BroadcastChannel(createDomChannelName('session-second'))

    try {
      firstRunner.postMessage({ type: 'ready' })
      secondRunner.postMessage({ type: 'ready' })
      await Promise.all([first.ready, second.ready])

      const firstResult = first.run(payload, 500)
      const secondResult = second.run(payload, 500)
      firstRunner.postMessage({ type: 'result', requestId: 'shared-request', result: measurement })
      await expect(firstResult).resolves.toEqual(measurement)

      const secondMeasurement = { ...measurement, iterations: 8 }
      secondRunner.postMessage({
        type: 'result',
        requestId: 'shared-request',
        result: secondMeasurement,
      })

      await expect(secondResult).resolves.toEqual(secondMeasurement)
    } finally {
      first.close()
      second.close()
      firstRunner.close()
      secondRunner.close()
    }
  })

  it('opens one noopener runner synchronously and resolves its handshake', async () => {
    const { channel, open, session } = createSession()

    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith(
      'http://localhost:3000/runner#jsbenchmark-dom-session-a',
      '_blank',
      expect.stringContaining('noopener')
    )
    expect(channel.name).toBe('jsbenchmark:dom:session-a')

    channel.emit({ type: 'ready' })
    await expect(session.ready).resolves.toBeUndefined()
  })

  it('correlates a request and ignores stale or unrelated results', async () => {
    const { channel, session } = createSession()

    channel.emit({ type: 'ready' })
    await session.ready

    const resultPromise = session.run(payload, 500)
    expect(channel.posted.at(-1)).toMatchObject({
      type: 'run',
      requestId: 'request-a',
      responseTimeoutMs: 500,
      payload,
    })

    channel.emit({
      type: 'result',
      requestId: 'stale',
      result: measurement,
    })
    channel.emit({
      type: 'result',
      requestId: 'request-a',
      result: measurement,
    })

    await expect(resultPromise).resolves.toEqual(measurement)
  })

  it('correlates concurrent requests when results finish out of order', async () => {
    const { channel, session } = createSession()

    channel.emit({ type: 'ready' })
    await session.ready

    const firstResult = session.run({ ...payload, setupHtml: '<p>first</p>' }, 500)
    const secondResult = session.run({ ...payload, setupHtml: '<p>second</p>' }, 500)

    expect(channel.posted.slice(-2)).toMatchObject([
      { type: 'run', requestId: 'request-a', payload: { setupHtml: '<p>first</p>' } },
      { type: 'run', requestId: 'request-b', payload: { setupHtml: '<p>second</p>' } },
    ])

    const secondMeasurement = { ...measurement, iterations: 8 }
    channel.emit({
      type: 'result',
      requestId: 'request-b',
      result: secondMeasurement,
    })
    await expect(secondResult).resolves.toEqual(secondMeasurement)

    channel.emit({
      type: 'result',
      requestId: 'request-a',
      result: measurement,
    })
    await expect(firstResult).resolves.toEqual(measurement)
  })

  it('rejects a blocked or missing runner after the readiness timeout and cleans up', async () => {
    vi.useFakeTimers()
    const { channel, session } = createSession()
    const readyResult = expect(session.ready).rejects.toThrow(
      'The DOM runner did not open. Allow popups for this site and try again.'
    )

    await vi.advanceTimersByTimeAsync(100)

    await readyResult
    expect(channel.closed).toBe(true)
  })

  it('treats a parent-watchdog timeout as terminal after allowing runner cleanup grace', async () => {
    vi.useFakeTimers()
    const { channel, session } = createSession()

    channel.emit({ type: 'ready' })
    await session.ready

    const runResult = expect(session.run(payload, 250)).rejects.toThrow(
      'The test was canceled because the timeout expired'
    )
    await vi.advanceTimersByTimeAsync(750)

    await runResult
    expect(channel.closed).toBe(true)
    await expect(session.run(payload, 250)).rejects.toThrow('The DOM runner session is closed.')
  })

  it('uses a longer response watchdog for parallel jobs without changing the case timeout', async () => {
    vi.useFakeTimers()
    const { channel, session } = createSession()

    channel.emit({ type: 'ready' })
    await session.ready

    const resultPromise = session.run(payload, 250, 1_000)
    expect(channel.posted.at(-1)).toMatchObject({
      type: 'run',
      requestId: 'request-a',
      responseTimeoutMs: 1_000,
    })

    await vi.advanceTimersByTimeAsync(750)

    expect(channel.closed).toBe(false)

    channel.emit({
      type: 'result',
      requestId: 'request-a',
      result: measurement,
    })
    await expect(resultPromise).resolves.toEqual(measurement)
  })

  it('reports visibility only for active work and clears it after the request', async () => {
    const onVisibilityChange = vi.fn()
    const { channel, session } = createSession({ onVisibilityChange })
    channel.emit({ type: 'ready' })
    channel.emit({ type: 'visibility', hidden: true })
    await session.ready

    const resultPromise = session.run(payload, 500)
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true)

    channel.emit({
      type: 'visibility',
      hidden: false,
    })
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false)

    channel.emit({
      type: 'result',
      requestId: 'request-a',
      result: measurement,
    })
    await resultPromise
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false)
  })

  it('keeps a hidden warning across sequential requests until visibility changes or the session closes', async () => {
    const onVisibilityChange = vi.fn()
    const { channel, session } = createSession({ onVisibilityChange })
    channel.emit({ type: 'ready' })
    channel.emit({ type: 'visibility', hidden: true })
    await session.ready

    const resultPromise = session.run(payload, 500)
    channel.emit({
      type: 'result',
      requestId: 'request-a',
      result: measurement,
    })
    await resultPromise

    expect(onVisibilityChange).toHaveBeenLastCalledWith(true)

    const secondResultPromise = session.run(payload, 500)
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true)
    channel.emit({
      type: 'result',
      requestId: 'request-b',
      result: measurement,
    })
    await secondResultPromise

    session.close()

    expect(onVisibilityChange).toHaveBeenLastCalledWith(false)
  })

  it('makes runner closure terminal during active work', async () => {
    const { channel, session } = createSession()

    channel.emit({ type: 'ready' })
    await session.ready

    const firstResult = session.run(payload, 500)
    const secondResult = session.run(payload, 500)
    channel.emit({
      type: 'closing',
    })
    await expect(firstResult).rejects.toThrow('The DOM runner closed before the test finished.')
    await expect(secondResult).rejects.toThrow('The DOM runner closed before the test finished.')

    expect(channel.closed).toBe(true)
    await expect(session.run(payload, 500)).rejects.toThrow('The DOM runner session is closed.')
  })

  it('rejects readiness and closes resources when explicitly closed before ready', async () => {
    const { channel, session } = createSession()
    const readyResult = expect(session.ready).rejects.toThrow('The DOM runner session was closed.')

    session.close()

    await readyResult
    expect(channel.closed).toBe(true)
  })

  it('makes runner closure terminal while idle and normally asks a ready runner to close', async () => {
    const idle = createSession()
    idle.channel.emit({ type: 'ready' })
    await idle.session.ready
    idle.channel.emit({ type: 'closing' })

    expect(idle.channel.closed).toBe(true)
    await expect(idle.session.run(payload, 500)).rejects.toThrow(
      'The DOM runner session is closed.'
    )

    const normal = createSession()
    normal.channel.emit({ type: 'ready' })
    await normal.session.ready
    normal.session.close()

    expect(normal.channel.posted.at(-1)).toEqual({ type: 'close' })
    expect(normal.channel.closed).toBe(true)
  })
})
