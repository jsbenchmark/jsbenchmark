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
  dependencies?: Dependency[]
}

export type TestState = {
  status: 'idle' | 'running' | 'success' | 'error'
  error?: Error | null
  result?: {
    opsPerSecond: number
    averageTime: number
    averageTimeFormatted: string
  }
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
