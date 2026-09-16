import { describe, expect, it } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  it('uses nanoseconds for sub-microsecond durations', () => {
    expect(formatDuration(0.00002656, 'en-US')).toBe('26.56 ns')
    expect(formatDuration(0.000000254, 'en-US')).toBe('0.254 ns')
  })

  it('uses microseconds for sub-millisecond durations', () => {
    expect(formatDuration(0.02656, 'en-US')).toBe('26.56 µs')
  })

  it('uses milliseconds for sub-second durations', () => {
    expect(formatDuration(26.56, 'en-US')).toBe('26.56 ms')
  })

  it('uses seconds for durations of at least one second', () => {
    expect(formatDuration(3_010, 'en-US')).toBe('3.01 s')
  })

  it('handles zero and missing durations', () => {
    expect(formatDuration(0, 'en-US')).toBe('0 ns')
    expect(formatDuration(undefined, 'en-US')).toBe('?')
  })
})
