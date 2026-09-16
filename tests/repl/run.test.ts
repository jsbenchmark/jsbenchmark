import { describe, expect, it, vi } from 'vitest'
import { runReplCode } from '../../app/utils/repl/run'
import type { ReplProgressEvent } from '../../app/utils/repl/types'

const silentConsole = () => ({
  ...console,
  assert: vi.fn(),
  clear: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  time: vi.fn(),
  timeEnd: vi.fn(),
  timeLog: vi.fn(),
  warn: vi.fn(),
})

describe('runReplCode', () => {
  it('distinguishes repeated references from cycles', async () => {
    const result = await runReplCode(
      { code: 'const shared = { value: 1 }; return [shared, shared]' },
      () => {},
      silentConsole()
    )

    expect(result.value).toBe('[{ value: 1 }, { value: 1 }]')
  })

  it('truncates large output', async () => {
    const result = await runReplCode(
      { code: "return Array(100).fill('x'.repeat(1000))" },
      () => {},
      silentConsole()
    )

    expect(result.value.length).toBeLessThanOrEqual(10000)
    expect(result.value).toContain('…')
  })

  it('streams regular console calls and returns a formatted result', async () => {
    const events: ReplProgressEvent[] = []

    const result = await runReplCode(
      {
        code: `
          console.log('hello', { answer: 42 })
          console.warn('careful')
          return { ok: true }
        `,
      },
      (event) => events.push(event),
      silentConsole()
    )

    expect(events).toEqual([
      {
        type: 'console',
        entry: { level: 'log', time: expect.any(Number), values: ['hello', '{ answer: 42 }'] },
      },
      {
        type: 'console',
        entry: { level: 'warn', time: expect.any(Number), values: ['careful'] },
      },
    ])
    expect(result.value).toBe('{ ok: true }')
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })

  it('formats values that cannot be JSON serialized without failing the run', async () => {
    const events: ReplProgressEvent[] = []

    await runReplCode(
      {
        code: `
          const circular = { name: 'example' }
          circular.self = circular
          console.log(circular, 10n, function demo() {})
        `,
      },
      (event) => events.push(event),
      silentConsole()
    )

    const entry = events.find((event) => event.type === 'console')

    expect(entry).toMatchObject({
      type: 'console',
      entry: {
        values: [expect.stringContaining('[Circular]'), '10n', expect.stringContaining('demo')],
      },
    })
  })

  it('supports failed assertions and clearing streamed console output', async () => {
    const events: ReplProgressEvent[] = []

    await runReplCode(
      {
        code: `
          console.assert(true, 'hidden')
          console.assert(false, 'visible')
          console.clear()
        `,
      },
      (event) => events.push(event),
      silentConsole()
    )

    expect(events).toEqual([
      {
        type: 'console',
        entry: {
          level: 'error',
          time: expect.any(Number),
          values: ['Assertion failed:', 'visible'],
        },
      },
      { type: 'console-clear' },
    ])
  })

  it('supports paired, synchronous callback, and asynchronous callback TIME calls', async () => {
    const events: ReplProgressEvent[] = []

    const result = await runReplCode(
      {
        code: `
          TIME('pair')
          TIME('pair')
          const sync = TIME('sync', () => 2)
          const asyncValue = await TIME('async', async () => 3)
          return sync + asyncValue
        `,
      },
      (event) => events.push(event),
      silentConsole()
    )

    expect(result.value).toBe('5')
    expect(result.markers.map((marker) => marker.name)).toEqual(['pair', 'sync', 'async'])
    expect(result.markers.every((marker) => marker.duration !== undefined)).toBe(true)

    const streamedMarkers: typeof result.markers = []

    for (const event of events) {
      if (event.type === 'timing') streamedMarkers[event.index] = event.marker
    }

    expect(streamedMarkers).toEqual(result.markers)
  })

  it('caps recorded timings while still executing every callback', async () => {
    const events: ReplProgressEvent[] = []

    const result = await runReplCode(
      {
        code: `
          let calls = 0
          for (let i = 0; i < 1100; i++) TIME('work', () => calls++)
          return calls
        `,
      },
      (event) => events.push(event),
      silentConsole()
    )

    expect(result.value).toBe('1100')
    expect(result.markers).toHaveLength(1000)
    expect(
      events.filter(
        (event) => event.type === 'console' && event.entry.values[0]?.includes('Timings truncated')
      )
    ).toHaveLength(1)
  })

  it.each([
    ['synchronous', "TIME('failure', () => { throw new Error('broken') })"],
    ['asynchronous', "await TIME('failure', async () => { throw new Error('broken') })"],
  ])('finishes timings when a %s callback fails', async (_mode, code) => {
    const events: ReplProgressEvent[] = []

    await expect(
      runReplCode({ code }, (event) => events.push(event), silentConsole())
    ).rejects.toThrow('broken')

    expect(events.at(-1)).toMatchObject({
      type: 'timing',
      index: 0,
      marker: { name: 'failure', duration: expect.any(Number) },
    })
  })

  it('captures native console timers as timing markers', async () => {
    const result = await runReplCode(
      {
        code: `
          console.time('load')
          console.timeLog('load')
          console.timeEnd('load')
        `,
      },
      () => {},
      silentConsole()
    )

    expect(result.markers.map((marker) => marker.name)).toEqual(['load', 'load (log)'])
    expect(result.markers.every((marker) => marker.duration !== undefined)).toBe(true)
  })
})
