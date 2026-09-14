export type BenchmarkWorkerOptions = {
  async?: boolean
  code: string
  dataCode: string
  targetBatchTime: number
  time: number
  warmupTime: number
}

export type BenchmarkWorkerResult = {
  batchSize: number
  elapsedMs: number
  iterations: number
  samplesMsPerOperation: number[]
}

export async function runBenchmarkWorker(
  { code, dataCode, time, warmupTime, targetBatchTime, async: isAsync }: BenchmarkWorkerOptions,
  dependencies?: unknown
): Promise<BenchmarkWorkerResult> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as FunctionConstructor
  const dataFunction = AsyncFunction(dataCode)
  const testFunction = isAsync ? AsyncFunction(code) : Function(code)
  const now = performance.now.bind(performance)

  ;(globalThis as { DATA?: unknown }).DATA = await dataFunction(dependencies)

  const runSyncBatch = (batchSize: number) => {
    for (let iteration = 0; iteration < batchSize; iteration++) testFunction()
  }
  const runAsyncBatch = async (batchSize: number) => {
    for (let iteration = 0; iteration < batchSize; iteration++) await testFunction()
  }

  const maximumBatchSize = 10_000_000
  let batchSize = 1
  let warmupElapsedMs = 0
  const warmupStart = now()

  do {
    const batchStart = now()
    if (isAsync) await runAsyncBatch(batchSize)
    else runSyncBatch(batchSize)
    const batchEnd = now()

    if (batchEnd - batchStart < targetBatchTime && batchSize < maximumBatchSize) {
      batchSize = Math.min(batchSize * 2, maximumBatchSize)
    }
    warmupElapsedMs = batchEnd - warmupStart
  } while (warmupElapsedMs < warmupTime)

  let elapsedMs = 0
  let iterations = 0
  const samplesMsPerOperation: number[] = []

  if (isAsync) {
    do {
      const batchStart = now()
      await runAsyncBatch(batchSize)
      const batchElapsedMs = now() - batchStart

      elapsedMs += batchElapsedMs
      iterations += batchSize
      samplesMsPerOperation.push(batchElapsedMs / batchSize)
    } while (elapsedMs < time)
  } else {
    do {
      const batchStart = now()
      runSyncBatch(batchSize)
      const batchElapsedMs = now() - batchStart

      elapsedMs += batchElapsedMs
      iterations += batchSize
      samplesMsPerOperation.push(batchElapsedMs / batchSize)
    } while (elapsedMs < time)
  }

  return { batchSize, elapsedMs, iterations, samplesMsPerOperation }
}
