<script setup lang="ts">
import type { TestCase, TestState } from '~/types'
import chroma from 'chroma-js'
import { COLORS } from '~/utils/constants'

const props = defineProps({
  cases: {
    type: Array as PropType<TestCase[]>,
    default: () => [],
  },
  stateByTest: {
    type: Object as PropType<Record<string, TestState>>,
    default: () => ({}),
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
</script>

<template>
  <div class="w-full space-y-[1.25em] text-[1em]">
    <div v-for="(test, i) in cases" :key="test.id">
      <div class="flex justify-between items-center mb-2">
        <div class="font-semibold text-[1.125em]">
          {{ test.name || `Test #${i + 1}` }}
        </div>
        <div class="font-mono">
          <span class="text-gray-400">Ops/s:</span>
          {{ stateByTest[test.id]?.result?.opsPerSecond?.toLocaleString() || '?' }}
        </div>
      </div>
      <div class="relative rounded-[0.375em] bg-gray-800/50">
        <div
          class="rounded-[0.375em] h-[2.75em] transition-all duration-500 striped"
          :class="{
            '!bg-gray-700': stateByTest[test.id]?.status === 'running',
            '!bg-gray-800':
              stateByTest[test.id]?.status !== 'running' && !stateByTest[test.id]?.result,
            'striped-animated': stateByTest[test.id]?.status === 'running',
            '!bg-red-600': stateByTest[test.id]?.status === 'error',
          }"
          :style="{
            backgroundColor: colors[i],
            width: !stateByTest[test.id]?.result
              ? '100%'
              : ((stateByTest[test.id]?.result?.opsPerSecond || 0) / maxOpsPerSecond) * 100 + '%',
          }"
        ></div>
      </div>
      <div class="text-[0.8em] mt-2.5 font-mono">
        <span class="text-gray-400">Average run time:</span>
        {{ stateByTest[test.id]?.result?.averageTimeFormatted || '?' }}
        <span v-if="stateByTest[test.id]?.result" class="text-gray-400">ms</span>
      </div>
      <hr v-if="i < cases.length - 1" class="mt-[1.25em] border-gray-800" />
    </div>
  </div>
</template>

<style scoped>
.striped {
  background-size: 2em 2em;
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.05) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0.05) 75%,
    transparent 75%,
    transparent
  );
}

.striped-animated {
  animation: 350ms linear 0s infinite normal none running stripes-animation;
}

@keyframes stripes-animation {
  0% {
    background-position: 0 0;
  }

  100% {
    background-position: 2rem 0;
  }
}
</style>
