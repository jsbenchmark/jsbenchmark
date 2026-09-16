import { describe, expect, it } from 'vitest'
import {
  createDomSessionFragment,
  isFrameToRunnerMessage,
  parseDomSessionFragment,
} from '../../app/utils/benchmark/dom/protocol'

describe('DOM benchmark protocol', () => {
  it('creates and parses a router-safe session fragment', () => {
    expect(createDomSessionFragment('session-a')).toBe('jsbenchmark-dom-session-a')
    expect(parseDomSessionFragment('jsbenchmark-dom-session-a')).toBe('session-a')
    expect(parseDomSessionFragment('session-a')).toBeUndefined()
    expect(parseDomSessionFragment('jsbenchmark-dom-<script>')).toBeUndefined()
    expect(parseDomSessionFragment('jsbenchmark-dom-%broken')).toBeUndefined()
  })

  it('accepts benchmark results and serialized errors from a frame', () => {
    expect(
      isFrameToRunnerMessage({
        type: 'result',
        result: { batchSize: 2, elapsedMs: 10, iterations: 4, samplesMsPerOperation: [2.5, 2.5] },
      })
    ).toBe(true)
    expect(
      isFrameToRunnerMessage({
        type: 'error',
        error: { name: 'TypeError', message: 'boom', stack: 'trace' },
      })
    ).toBe(true)
  })

  it.each([
    null,
    { type: 'ready' },
    { type: 'result', result: {} },
    {
      type: 'result',
      result: {
        batchSize: 1,
        elapsedMs: Infinity,
        iterations: 1,
        samplesMsPerOperation: [1],
      },
    },
    {
      type: 'result',
      result: {
        batchSize: 1,
        elapsedMs: 1,
        iterations: 1,
        samplesMsPerOperation: ['1'],
      },
    },
    { type: 'error', error: { name: 'Error', message: {} } },
  ])('rejects malformed sandbox output: %j', (message) => {
    expect(isFrameToRunnerMessage(message)).toBe(false)
  })
})
