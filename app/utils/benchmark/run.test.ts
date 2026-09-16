import { afterEach, describe, expect, it, vi } from 'vitest'
import { runBenchmark } from './run'

const installClock = () => {
  let elapsed = 0
  const now = vi.fn(() => elapsed)

  vi.stubGlobal('performance', { now })
  vi.stubGlobal('advanceBenchmarkClock', (milliseconds: number) => {
    elapsed += milliseconds
  })

  return now
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runBenchmark', () => {
  it('calibrates a batch and reports actual elapsed time', async () => {
    installClock()

    const result = await runBenchmark({
      async: false,
      code: 'globalThis.advanceBenchmarkClock(1)',
      dataCode: 'return null',
      targetBatchTime: 10,
      time: 100,
      warmupTime: 20,
    })

    expect(result.batchSize).toBe(16)
    expect(result.elapsedMs).toBe(112)
    expect(result.iterations).toBe(112)
    expect(result.samplesMsPerOperation).toEqual(Array(7).fill(1))
  })

  it('keeps timer reads far below the operation count for fast functions', async () => {
    const now = installClock()

    const result = await runBenchmark({
      async: false,
      code: 'globalThis.advanceBenchmarkClock(0.001)',
      dataCode: 'return null',
      targetBatchTime: 10,
      time: 100,
      warmupTime: 20,
    })

    expect(result.iterations).toBeGreaterThan(100_000)
    expect(now.mock.calls.length).toBeLessThan(100)
  })

  it('awaits asynchronous test cases', async () => {
    installClock()

    const result = await runBenchmark({
      async: true,
      code: 'await globalThis.advanceBenchmarkClock(2)',
      dataCode: 'return null',
      targetBatchTime: 5,
      time: 20,
      warmupTime: 10,
    })

    expect(result.samplesMsPerOperation.every((sample) => sample === 2)).toBe(true)
    expect(result.elapsedMs).toBeGreaterThanOrEqual(20)
  })

  it('propagates errors from a test case', async () => {
    installClock()

    await expect(
      runBenchmark({
        async: false,
        code: 'throw new Error("boom")',
        dataCode: 'return null',
        targetBatchTime: 10,
        time: 100,
        warmupTime: 20,
      })
    ).rejects.toThrow('boom')
  })

  it('remains self-contained when serialized into a worker', async () => {
    installClock()
    const serializedRunner = Function(
      `return (${runBenchmark.toString()})`
    )() as typeof runBenchmark

    const result = await serializedRunner({
      async: false,
      code: 'globalThis.advanceBenchmarkClock(1)',
      dataCode: 'return null',
      targetBatchTime: 10,
      time: 20,
      warmupTime: 10,
    })

    expect(result.elapsedMs).toBeGreaterThanOrEqual(20)
  })
})
