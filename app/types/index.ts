import type { BenchmarkSummary } from '~/utils/benchmark/summary'

export type Config = {
  name: string
  parallel: boolean
  globalTestConfig: TestCase
  dataCode: string
}

export type Dependency = {
  url: string
  name?: string
  esm?: boolean
}

export type TestCase = {
  id: string
  name?: string
  code: string
  esm?: boolean
  async?: boolean
  dependencies: Dependency[]
}

export type TestState = {
  status: 'idle' | 'running' | 'success' | 'error'
  error?: Error | null
  result?: BenchmarkSummary
}

export type TimeMarker = {
  name: string
  time: number
  duration?: number
  durationPercentage?: number
}

export type LogEntry = {
  value: string
  time: number
}

export type ReplState = {
  status: 'idle' | 'running' | 'success' | 'error'
  error?: Error | null
  result?: {
    duration?: number
    markers: TimeMarker[]
    logs: LogEntry[]
  }
}
