import type {
  ReplConsoleEntry,
  ReplConsoleLevel,
  ReplProgressEvent,
  ReplRunResult,
  ReplTimeMarker,
} from './types'

export async function runReplCode(
  { code }: { code: string },
  emit: (event: ReplProgressEvent) => void = (event) =>
    (globalThis as { postMessage: (message: unknown) => void }).postMessage(['PROGRESS', event]),
  nativeConsole: Console = console,
  now: () => number = () => performance.now()
): Promise<ReplRunResult> {
  const outputLimit = 1_000
  const valueDepthLimit = 4
  const valueEntryLimit = 50
  const valueStringLimit = 10_000

  const formatValue = (value: unknown) => {
    const ancestors = new WeakSet<object>()
    const chunks: string[] = []
    let remaining = valueStringLimit

    const write = (text: string) => {
      if (!remaining) return
      const chunk = text.length > remaining ? `${text.slice(0, remaining - 1)}…` : text
      chunks.push(chunk)
      remaining -= chunk.length
    }
    const collection = <T>(
      open: string,
      close: string,
      entries: Iterable<T>,
      visit: (entry: T) => void
    ) => {
      write(open)
      let count = 0
      for (const entry of entries) {
        if (!remaining) break
        if (count) write(', ')
        if (count++ === valueEntryLimit) {
          write('…')
          break
        }
        visit(entry)
      }
      write(close)
    }
    const format = (candidate: unknown, depth: number, nested: boolean): void => {
      if (!remaining) return
      try {
        if (typeof candidate === 'string') {
          write(nested ? JSON.stringify(candidate.slice(0, remaining)) : candidate)
          return
        }
        if (typeof candidate === 'function') {
          write(Function.prototype.toString.call(candidate))
          return
        }
        if (typeof candidate === 'bigint') {
          write(`${candidate}n`)
          return
        }
        if (candidate === null || typeof candidate !== 'object') {
          write(Object.is(candidate, -0) ? '-0' : String(candidate))
          return
        }
        if (candidate instanceof Error) {
          write(candidate.stack || candidate.toString())
          return
        }
        if (candidate instanceof Date) {
          write(Number.isNaN(candidate.getTime()) ? 'Invalid Date' : candidate.toISOString())
          return
        }
        if (candidate instanceof RegExp) {
          write(String(candidate))
          return
        }
        if (
          'nodeType' in candidate &&
          candidate.nodeType === 1 &&
          'outerHTML' in candidate &&
          typeof candidate.outerHTML === 'string'
        ) {
          write(candidate.outerHTML)
          return
        }
        if (ancestors.has(candidate)) {
          write('[Circular]')
          return
        }
        if (depth >= valueDepthLimit) {
          write(Array.isArray(candidate) ? '[Array]' : '[Object]')
          return
        }

        ancestors.add(candidate)
        try {
          const visit = (entry: unknown) => format(entry, depth + 1, true)
          if (Array.isArray(candidate)) {
            collection('[', ']', candidate, visit)
          } else if (candidate instanceof Map) {
            collection(`Map(${candidate.size}) { `, ' }', candidate.entries(), ([key, entry]) => {
              visit(key)
              write(' => ')
              visit(entry)
            })
          } else if (candidate instanceof Set) {
            collection(`Set(${candidate.size}) { `, ' }', candidate.values(), visit)
          } else {
            collection('{ ', ' }', Object.getOwnPropertyNames(candidate), (key) => {
              write(/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key))
              write(': ')
              const descriptor = Object.getOwnPropertyDescriptor(candidate, key)
              if (descriptor && 'value' in descriptor) visit(descriptor.value)
              else write(descriptor?.get ? '[Getter]' : 'undefined')
            })
          }
        } finally {
          ancestors.delete(candidate)
        }
      } catch {
        write('[Unserializable value]')
      }
    }

    format(value, 0, false)
    return chunks.join('')
  }

  const startedAt = now()
  let consoleEntryCount = 0
  type TrackedMarker = ReplTimeMarker & { index: number }
  const markers: TrackedMarker[] = []
  let timingsTruncated = false

  const elapsed = () => now() - startedAt
  const callNative = (method: keyof Console, values: unknown[]) => {
    try {
      const nativeMethod = nativeConsole[method]
      if (typeof nativeMethod === 'function') Reflect.apply(nativeMethod, nativeConsole, values)
    } catch {
      // Console mirroring must never change the user's program behavior.
    }
  }
  const writeConsole = (level: ReplConsoleLevel, values: unknown[]) => {
    callNative(level, values)
    if (consoleEntryCount > outputLimit) return

    let entry: ReplConsoleEntry
    if (consoleEntryCount === outputLimit) {
      entry = {
        level: 'warn',
        time: elapsed(),
        values: [`Console output truncated after ${outputLimit.toLocaleString('en-US')} entries.`],
      }
    } else {
      entry = { level, time: elapsed(), values: values.map(formatValue) }
    }

    consoleEntryCount += 1
    emit({ type: 'console', entry })
  }
  const publishTiming = ({ index, ...marker }: TrackedMarker) => {
    emit({ type: 'timing', index, marker })
  }
  const addMarker = (name: string, time = elapsed(), duration?: number) => {
    if (markers.length >= outputLimit) {
      if (!timingsTruncated) {
        timingsTruncated = true
        writeConsole('warn', [
          `Timings truncated after ${outputLimit.toLocaleString('en-US')} entries.`,
        ])
      }
      return
    }
    const marker: TrackedMarker = { index: markers.length, name, time, duration }
    markers.push(marker)
    publishTiming(marker)
    return marker
  }
  const finishMarker = (marker: TrackedMarker | undefined) => {
    if (!marker) return
    marker.duration = elapsed() - marker.time
    publishTiming(marker)
  }

  const TIME = (name: unknown, callback?: unknown): unknown => {
    const markerName = String(name)
    if (typeof callback !== 'function') {
      const openMarker = markers.findLast(
        (marker) => marker.name === markerName && marker.duration === undefined
      )
      if (openMarker) finishMarker(openMarker)
      else addMarker(markerName)
      return
    }

    const marker = addMarker(markerName)

    try {
      const value = callback()
      if (
        value !== null &&
        (typeof value === 'object' || typeof value === 'function') &&
        typeof (value as PromiseLike<unknown>).then === 'function'
      ) {
        return Promise.resolve(value).finally(() => finishMarker(marker))
      }
      finishMarker(marker)
      return value
    } catch (error) {
      finishMarker(marker)
      throw error
    }
  }

  const consoleTimers = new Map<string, TrackedMarker>()
  const instrumentedConsole = Object.create(nativeConsole) as Console
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    instrumentedConsole[level] = (...values: unknown[]) => writeConsole(level, values)
  }
  instrumentedConsole.assert = (condition?: boolean, ...values: unknown[]) => {
    callNative('assert', [condition, ...values])
    if (!condition) writeConsole('error', ['Assertion failed:', ...values])
  }
  instrumentedConsole.clear = () => {
    callNative('clear', [])
    consoleEntryCount = 0
    emit({ type: 'console-clear' })
  }
  instrumentedConsole.time = (label = 'default') => {
    const name = String(label)
    callNative('time', [name])
    if (consoleTimers.has(name)) {
      writeConsole('warn', [`Timer '${name}' already exists`])
      return
    }
    const marker = addMarker(name)
    if (marker) consoleTimers.set(name, marker)
  }
  instrumentedConsole.timeLog = (label = 'default', ...values: unknown[]) => {
    const name = String(label)
    callNative('timeLog', [name, ...values])
    const marker = consoleTimers.get(name)
    if (!marker) {
      if (!timingsTruncated) writeConsole('warn', [`Timer '${name}' does not exist`])
      return
    }
    addMarker(`${name} (log)`, marker.time, elapsed() - marker.time)
  }
  instrumentedConsole.timeEnd = (label = 'default') => {
    const name = String(label)
    callNative('timeEnd', [name])
    const marker = consoleTimers.get(name)
    if (!marker) {
      if (!timingsTruncated) writeConsole('warn', [`Timer '${name}' does not exist`])
      return
    }
    consoleTimers.delete(name)
    finishMarker(marker)
  }

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const execute = AsyncFunction('console', 'TIME', 'LOG', code)
  const value = await execute(instrumentedConsole, TIME, instrumentedConsole.log)
  const duration = elapsed()

  return {
    duration,
    markers: markers.map(({ index, ...marker }) => marker),
    value: formatValue(value),
  }
}
