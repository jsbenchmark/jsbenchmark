export type BenchmarkStatistics = {
  mean: number
  median: number
  p95: number
  relativeMarginOfError: number | null
  sampleCount: number
  standardDeviation: number
}

// Two-tailed Student's t critical values for a 95% confidence interval.
const T_CRITICAL_95 = [
  12.7062047364, 4.3026527297, 3.1824463053, 2.7764451052, 2.5705818366,
  2.4469118511, 2.364624251, 2.3060041352, 2.2621571629, 2.228138852,
  2.2009851601, 2.1788128297, 2.1603686565, 2.1447866879, 2.1314495456,
  2.1199052992, 2.1098155778, 2.1009220402, 2.0930240544, 2.0859634473,
  2.0796138447, 2.0738730679, 2.0686576104, 2.0638985616, 2.0595385528,
  2.0555294386, 2.0518305165, 2.0484071418, 2.0452296421, 2.0422724563,
]

const criticalValue95 = (degreesOfFreedom: number) => {
  if (degreesOfFreedom <= 30) return T_CRITICAL_95[degreesOfFreedom - 1]!
  if (degreesOfFreedom <= 40) return 2.0210753903
  if (degreesOfFreedom <= 60) return 2.0002978211
  if (degreesOfFreedom <= 120) return 1.9799304051
  return 1.9599639845
}

const quantile = (sortedSamples: number[], percentile: number) => {
  const position = (sortedSamples.length - 1) * percentile
  const lowerIndex = Math.floor(position)
  const lower = sortedSamples[lowerIndex]!
  const upper = sortedSamples[lowerIndex + 1]

  return upper === undefined ? lower : lower + (position - lowerIndex) * (upper - lower)
}

export const calculateStatistics = (samples: number[]): BenchmarkStatistics => {
  if (!samples.length) throw new Error('Benchmark statistics require at least one sample')
  if (samples.some((sample) => !Number.isFinite(sample))) {
    throw new Error('Benchmark statistics require finite samples')
  }

  let mean = 0
  let sumOfSquaredDifferences = 0

  samples.forEach((sample, index) => {
    const difference = sample - mean
    mean += difference / (index + 1)
    sumOfSquaredDifferences += difference * (sample - mean)
  })

  const sampleCount = samples.length
  const standardDeviation =
    sampleCount > 1 ? Math.sqrt(sumOfSquaredDifferences / (sampleCount - 1)) : 0
  const standardError = standardDeviation / Math.sqrt(sampleCount)
  const relativeMarginOfError =
    sampleCount > 1 && mean !== 0
      ? ((standardError * criticalValue95(sampleCount - 1)) / Math.abs(mean)) * 100
      : null
  const sortedSamples = [...samples].sort((a, b) => a - b)

  return {
    mean,
    median: quantile(sortedSamples, 0.5),
    p95: quantile(sortedSamples, 0.95),
    relativeMarginOfError,
    sampleCount,
    standardDeviation,
  }
}
