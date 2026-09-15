import type { TestCase, TestState } from '~/types'
import { formatDuration } from './format'

export type BenchmarkExportFormat = 'csv' | 'json' | 'markdown'
type ExportCell = string | number | null

type BenchmarkExportResult =
  | {
      error: string
      status: 'error'
      test: string
    }
  | {
      averageTimeMs: number
      batchSize: number
      elapsedMs: number
      iterations: number
      opsPerSecond: number
      relativeToFastestPercent: number
      statistics: {
        meanMsPerOperation: number
        medianMsPerOperation: number
        p95MsPerOperation: number
        relativeMarginOfErrorPercent: number | null
        sampleCount: number
        standardDeviationMsPerOperation: number
      }
      status: 'success'
      test: string
    }

const HEADERS = [
  'Benchmark',
  'Test',
  'Status',
  'Error',
  'Ops/s',
  'Average',
  'Mean batch',
  'Median',
  'p95',
  'Std deviation',
  '95% RME',
  'Batches',
  'Operations',
  'Measured',
  'Relative',
] as const

const CSV_UNITS: Partial<Record<(typeof HEADERS)[number], string>> = {
  Average: 'ms/op',
  'Mean batch': 'ms/op',
  Median: 'ms/op',
  p95: 'ms/op',
  'Std deviation': 'ms/op',
  '95% RME': '%',
  Measured: 'ms',
  Relative: '% slower',
}

const CSV_HEADERS = HEADERS.map((header) =>
  CSV_UNITS[header] ? `${header} (${CSV_UNITS[header]})` : header
)

const number = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 4 })

const percentage = (value: number | null) => (value === null ? '—' : `${number(value)}%`)

const markdownCell = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

const csvCell = (value: string | number | null) => {
  if (value === null) return ''
  const stringValue =
    typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value)
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue
}

const getResults = (
  cases: TestCase[],
  stateByTest: Record<string, TestState>
): BenchmarkExportResult[] => {
  const fastestOpsPerSecond = Math.max(
    0,
    ...cases.map((test) => stateByTest[test.id]?.result?.opsPerSecond || 0)
  )

  return cases.flatMap<BenchmarkExportResult>((test, index): BenchmarkExportResult[] => {
    const state = stateByTest[test.id]
    const name = test.name || `Test #${index + 1}`

    if (state?.status === 'error') {
      return [{ error: state.error?.message || 'Unknown error', status: 'error', test: name }]
    }

    if (state?.status !== 'success' || !state.result) return []

    const { result } = state
    return [
      {
        averageTimeMs: result.averageTime,
        batchSize: result.batchSize,
        elapsedMs: result.elapsedMs,
        iterations: result.iterations,
        opsPerSecond: result.opsPerSecond,
        relativeToFastestPercent: (1 - result.opsPerSecond / fastestOpsPerSecond) * 100,
        statistics: {
          meanMsPerOperation: result.statistics.mean,
          medianMsPerOperation: result.statistics.median,
          p95MsPerOperation: result.statistics.p95,
          relativeMarginOfErrorPercent: result.statistics.relativeMarginOfError,
          sampleCount: result.statistics.sampleCount,
          standardDeviationMsPerOperation: result.statistics.standardDeviation,
        },
        status: 'success',
        test: name,
      },
    ]
  })
}

const toRows = (
  benchmarkName: string,
  results: BenchmarkExportResult[],
  humanReadable: boolean
): ExportCell[][] =>
  results.map((result) => {
    if (result.status === 'error') {
      return [
        benchmarkName,
        result.test,
        humanReadable ? 'Error' : result.status,
        result.error,
        ...Array(11).fill(humanReadable ? '—' : ''),
      ]
    }

    if (humanReadable) {
      const relative =
        result.relativeToFastestPercent < 0.05
          ? 'Fastest'
          : `${number(result.relativeToFastestPercent)}% slower`
      return [
        benchmarkName,
        result.test,
        'Success',
        '',
        number(result.opsPerSecond),
        formatDuration(result.averageTimeMs, 'en-US'),
        formatDuration(result.statistics.meanMsPerOperation, 'en-US'),
        formatDuration(result.statistics.medianMsPerOperation, 'en-US'),
        formatDuration(result.statistics.p95MsPerOperation, 'en-US'),
        formatDuration(result.statistics.standardDeviationMsPerOperation, 'en-US'),
        percentage(result.statistics.relativeMarginOfErrorPercent),
        number(result.statistics.sampleCount),
        number(result.iterations),
        formatDuration(result.elapsedMs, 'en-US'),
        relative,
      ]
    }

    return [
      benchmarkName,
      result.test,
      result.status,
      '',
      result.opsPerSecond,
      result.averageTimeMs,
      result.statistics.meanMsPerOperation,
      result.statistics.medianMsPerOperation,
      result.statistics.p95MsPerOperation,
      result.statistics.standardDeviationMsPerOperation,
      result.statistics.relativeMarginOfErrorPercent,
      result.statistics.sampleCount,
      result.iterations,
      result.elapsedMs,
      result.relativeToFastestPercent,
    ]
  })

const toMarkdown = (benchmarkName: string, rows: ExportCell[][]) => {
  const table = [HEADERS, HEADERS.map((_, index) => (index > 3 ? '---:' : '---')), ...rows]
    .map(
      (row) =>
        `| ${row.map((cell) => markdownCell(cell === null ? '' : String(cell))).join(' | ')} |`
    )
    .join('\n')

  return `# ${benchmarkName.replace(/\r?\n/g, ' ')}\n\n${table}\n\n> Latency statistics are per-operation averages from timed batches.`
}

const toCsv = (rows: ExportCell[][]) =>
  [CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')

export const formatBenchmarkResults = (
  benchmarkName: string,
  cases: TestCase[],
  stateByTest: Record<string, TestState>,
  format: BenchmarkExportFormat
) => {
  const name = benchmarkName || 'Untitled benchmark'
  const results = getResults(cases, stateByTest)

  if (format === 'markdown') return toMarkdown(name, toRows(name, results, true))
  if (format === 'csv') return toCsv(toRows(name, results, false))
  return JSON.stringify({ name, results }, null, 2)
}
