import type { Dependency } from '../../types'

export type ReplRuntime = 'worker' | 'dom'
export type ReplColorMode = 'light' | 'dark'

export type ReplConfig = {
  name: string
  runtime: ReplRuntime
  setupHtml: string
  test: {
    id: string
    code: string
    dependencies: Dependency[]
  }
}

export type ReplConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export type ReplConsoleEntry = {
  level: ReplConsoleLevel
  time: number
  values: string[]
}

export type ReplTimeMarker = {
  name: string
  time: number
  duration?: number
}

export type ReplProgressEvent =
  | { type: 'console'; entry: ReplConsoleEntry }
  | { type: 'console-clear' }
  | { type: 'timing'; index: number; marker: ReplTimeMarker }

export type ReplRunResult = {
  duration: number
  markers: ReplTimeMarker[]
  value: string
}

export type ReplOutput = {
  logs: ReplConsoleEntry[]
  markers: ReplTimeMarker[]
}

export type ReplCompletedState =
  | { status: 'success'; config: ReplConfig; output: ReplOutput & ReplRunResult }
  | { status: 'error'; config: ReplConfig; error: Error; output: ReplOutput }

export type ReplState =
  | { status: 'idle'; output: ReplOutput }
  | { status: 'running'; config: ReplConfig; output: ReplOutput }
  | ReplCompletedState

export type ReplRunPayload = {
  code: string
  colorMode: ReplColorMode
  dependencies: Dependency[]
  setupHtml: string
}
