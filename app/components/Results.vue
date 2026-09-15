<script setup lang="ts">
import type { TestCase, TestState } from '~/types'
import chroma from 'chroma-js'
import { COLORS } from '~/utils/constants'
import { formatDuration } from '~/utils/benchmark/format'

const props = defineProps({
  cases: {
    type: Array as PropType<TestCase[]>,
    default: () => [],
  },
  stateByTest: {
    type: Object as PropType<Record<string, TestState>>,
    default: () => ({}),
  },
  showStatistics: {
    type: Boolean,
    default: false,
  },
  showSummaryStatistics: {
    type: Boolean,
    default: false,
  },
})

const maxOpsPerSecond = computed(() => {
  return Math.max(
    ...props.cases.map((c) => {
      const state = props.stateByTest[c.id]
      if (!state || state.status !== 'success') return 0
      return state.result?.opsPerSecond || 0
    })
  )
})

const colorScale = chroma.scale(COLORS.GRADIENT).mode('lch').domain([0, 1])

const colors = computed(() => {
  return props.cases.map((c) => {
    const state = props.stateByTest[c.id]
    if (!state || state.status !== 'success') return COLORS.ERROR
    const percentage = (state.result?.opsPerSecond || 0) / maxOpsPerSecond.value
    return colorScale(percentage).hex()
  })
})

const formatNumber = (value: number | undefined) =>
  value?.toLocaleString(undefined, { maximumSignificantDigits: 4 }) || '?'

const formatCount = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 })

const formatPercentage = (value: number | null) =>
  value === null ? '—' : `${formatNumber(value)}%`

const formatRelativeToFastest = (opsPerSecond: number) => {
  const difference = (1 - opsPerSecond / maxOpsPerSecond.value) * 100
  return difference < 0.05 ? 'Fastest' : `${formatNumber(difference)}% slower`
}
</script>

<template>
  <div class="w-full space-y-[1.25em] text-[1em]">
    <div v-for="(test, i) in cases" :key="test.id">
      <div class="flex justify-between items-center mb-2">
        <div class="font-semibold text-[1.125em]">
          {{ test.name || `Test #${i + 1}` }}
        </div>
        <div class="font-mono">
          <span v-if="stateByTest[test.id]?.status === 'running'" class="text-gray-400">
            Running…
          </span>
          <template v-else>
            <span class="text-gray-400">Ops/s:</span>
            {{ formatNumber(stateByTest[test.id]?.result?.opsPerSecond) }}
          </template>
        </div>
      </div>
      <div class="relative rounded-[0.375em] bg-gray-800">
        <div
          class="rounded-[0.375em] h-[2.75em] transition-all duration-500 striped"
          :class="{
            '!bg-gray-300': stateByTest[test.id]?.status === 'running',
            '!bg-gray-800':
              stateByTest[test.id]?.status !== 'running' && !stateByTest[test.id]?.result,
            'benchmark-progress': stateByTest[test.id]?.status === 'running',
            'striped-animated': stateByTest[test.id]?.status === 'running',
            '!bg-red-600': stateByTest[test.id]?.status === 'error',
          }"
          :style="{
            '--color':
              stateByTest[test.id]?.status === 'running'
                ? 'rgba(0, 0, 0, 0.05)'
                : 'rgba(255, 255, 255, 0.05)',
            '--benchmark-duration': `${stateByTest[test.id]?.estimatedDurationMs || 0}ms`,
            backgroundColor: colors[i],
            width: !stateByTest[test.id]?.result
              ? '100%'
              : ((stateByTest[test.id]?.result?.opsPerSecond || 0) / maxOpsPerSecond) * 100 + '%',
          }"
        ></div>
      </div>
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.8em] mt-2.5 font-mono">
        <span class="whitespace-nowrap">
          <span class="text-gray-400">Average run time:</span>
          {{ formatDuration(stateByTest[test.id]?.result?.averageTime) }}
        </span>
        <template v-if="showSummaryStatistics && stateByTest[test.id]?.result">
          <span class="whitespace-nowrap">
            <span class="text-gray-400">· Median:</span>
            {{ formatDuration(stateByTest[test.id]!.result!.statistics.median) }}
          </span>
          <span class="whitespace-nowrap">
            <span class="text-gray-400">· p95:</span>
            {{ formatDuration(stateByTest[test.id]!.result!.statistics.p95) }}
          </span>
          <span class="whitespace-nowrap">
            <span class="text-gray-400">· Std deviation:</span>
            {{ formatDuration(stateByTest[test.id]!.result!.statistics.standardDeviation) }}
          </span>
          <span class="whitespace-nowrap">
            <span class="text-gray-400">· 95% RME:</span>
            {{ formatPercentage(stateByTest[test.id]!.result!.statistics.relativeMarginOfError) }}
          </span>
        </template>
      </div>
      <template v-if="showStatistics && stateByTest[test.id]?.result">
        <dl
          class="grid grid-cols-2 gap-x-5 gap-y-3 mt-3 p-3 rounded-md border border-gray-800 bg-gray-900/50 text-xs font-mono"
        >
          <div>
            <dt class="text-gray-400">Median</dt>
            <dd>{{ formatDuration(stateByTest[test.id]!.result!.statistics.median) }}</dd>
          </div>
          <div>
            <dt class="text-gray-400">p95</dt>
            <dd>{{ formatDuration(stateByTest[test.id]!.result!.statistics.p95) }}</dd>
          </div>
          <div>
            <dt class="text-gray-400">Std deviation</dt>
            <dd>
              {{ formatDuration(stateByTest[test.id]!.result!.statistics.standardDeviation) }}
            </dd>
          </div>
          <div>
            <dt class="text-gray-400" title="Approximate 95% relative margin of error for the mean">
              95% RME
            </dt>
            <dd>
              {{ formatPercentage(stateByTest[test.id]!.result!.statistics.relativeMarginOfError) }}
            </dd>
          </div>
          <div>
            <dt class="text-gray-400">Batches</dt>
            <dd>{{ formatCount(stateByTest[test.id]!.result!.statistics.sampleCount) }}</dd>
          </div>
          <div>
            <dt class="text-gray-400">Operations</dt>
            <dd>{{ formatCount(stateByTest[test.id]!.result!.iterations) }}</dd>
          </div>
          <div>
            <dt class="text-gray-400">Measured</dt>
            <dd>{{ formatDuration(stateByTest[test.id]!.result!.elapsedMs) }}</dd>
          </div>
          <div>
            <dt class="text-gray-400">Relative</dt>
            <dd>
              {{ formatRelativeToFastest(stateByTest[test.id]!.result!.opsPerSecond) }}
            </dd>
          </div>
        </dl>
        <p
          v-if="stateByTest[test.id]!.result!.statistics.sampleCount < 10"
          role="status"
          class="mt-2 text-xs text-amber-400"
        >
          Limited statistics: fewer than 10 timed batches were collected.
        </p>
      </template>
      <hr v-if="i < cases.length - 1" class="mt-[1.25em] border-gray-800" />
    </div>
  </div>
</template>

<style scoped>
.striped {
  --color: rgba(255, 255, 255, 0.05);
  background-size: 2em 2em;
  background-image: linear-gradient(
    45deg,
    var(--color) 25%,
    transparent 25%,
    transparent 50%,
    var(--color) 50%,
    var(--color) 75%,
    transparent 75%,
    transparent
  );
}

.striped-animated {
  animation: 350ms linear 0s infinite normal none running stripes-animation;
}

.striped-animated.benchmark-progress {
  animation:
    350ms linear infinite stripes-animation,
    var(--benchmark-duration) linear forwards benchmark-progress-animation;
}

@keyframes benchmark-progress-animation {
  from {
    clip-path: inset(0 100% 0 0 round 0.375em);
  }

  to {
    clip-path: inset(0 0 0 0 round 0.375em);
  }
}

@media (prefers-reduced-motion: reduce) {
  .striped-animated.benchmark-progress {
    animation: none;
    clip-path: inset(0 0 0 0 round 0.375em);
  }
}

@keyframes stripes-animation {
  0% {
    background-position: 0 0;
  }

  100% {
    background-position: -2rem 0;
  }
}
</style>
