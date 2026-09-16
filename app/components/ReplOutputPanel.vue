<script setup lang="ts">
import chroma from 'chroma-js'
import type { ReplConsoleLevel, ReplState } from '~/utils/repl/types'
import { COLORS } from '~/utils/constants'

const props = defineProps<{
  state: ReplState
}>()

const emit = defineEmits<{
  (event: 'copy-markdown'): void
}>()

const activeTab = ref<'console' | 'timings'>('console')
const tabs = [
  { label: 'Console', value: 'console' },
  { label: 'Timings', value: 'timings' },
]
const colorScale = chroma.scale(COLORS.GRADIENT).mode('lch').domain([0, 1])
const maxTimerDuration = computed(() =>
  Math.max(0, ...props.state.output.markers.map((marker) => marker.duration || 0))
)

const levelPresentation: Record<ReplConsoleLevel, { icon: string; label: string; text: string }> = {
  log: { icon: 'i-tabler-terminal-2', label: 'Log', text: 'text-toned' },
  info: { icon: 'i-tabler-info-circle', label: 'Info', text: 'text-info' },
  warn: { icon: 'i-tabler-alert-triangle', label: 'Warning', text: 'text-warning' },
  error: { icon: 'i-tabler-circle-x', label: 'Error', text: 'text-error' },
  debug: { icon: 'i-tabler-bug', label: 'Debug', text: 'text-muted' },
}
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-3xl font-bold">Output</h2>
      <UTooltip text="Copy the latest investigation as Markdown">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-tabler-markdown"
          :disabled="state.status === 'idle' || state.status === 'running'"
          @click="emit('copy-markdown')"
        >
          Copy as Markdown
        </UButton>
      </UTooltip>
    </div>

    <div class="mb-7" aria-live="polite">
      <p v-if="state.status === 'idle'" class="text-muted">
        Run the code to see its result, console output, and timings.
      </p>
      <div v-else-if="state.status === 'running'" class="flex items-center gap-2 text-muted">
        <UIcon name="i-tabler-loader-2" class="size-4 animate-spin" aria-hidden="true" />
        <span>Running…</span>
      </div>
      <UAlert
        v-else-if="state.status === 'error'"
        color="error"
        variant="subtle"
        title="Execution failed"
        :description="state.error.message"
        icon="i-tabler-alert-circle"
      />
      <div v-else class="space-y-3">
        <div class="flex items-center justify-between gap-3 text-sm text-muted">
          <span class="inline-flex items-center gap-1.5 font-medium text-success">
            <UIcon name="i-tabler-circle-check" class="size-4" aria-hidden="true" />
            Complete
          </span>
          <span class="font-mono"> {{ state.output.duration.toFixed(3) }} ms </span>
        </div>
        <div>
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Result</p>
          <pre
            aria-label="Result"
            class="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-default bg-muted p-3 font-mono text-sm"
            >{{ state.output.value }}</pre>
        </div>
      </div>
    </div>

    <UTabs
      v-model="activeTab"
      :items="tabs"
      :content="false"
      aria-label="REPL output"
      variant="outline"
      size="sm"
      class="mb-6"
    />

    <div class="lg:max-h-[calc(100dvh-18rem)] lg:overflow-y-auto lg:pr-2">
      <div v-if="activeTab === 'console'">
        <p v-if="!state.output.logs.length" class="text-sm leading-relaxed text-muted">
          Nothing logged. Use <code class="text-highlighted">console.log(...)</code> or another
          standard console method.
        </p>
        <ol v-else class="space-y-4" aria-label="Console output">
          <li
            v-for="(entry, index) in state.output.logs"
            :key="index"
            class="border-b border-default pb-4 last:border-0"
          >
            <div class="mb-1.5 flex items-center gap-2 text-xs text-muted">
              <span
                class="inline-flex items-center gap-1 font-semibold"
                :class="levelPresentation[entry.level].text"
              >
                <UIcon
                  :name="levelPresentation[entry.level].icon"
                  class="size-3.5"
                  aria-hidden="true"
                />
                {{ levelPresentation[entry.level].label }}
              </span>
              <span class="font-mono">{{ entry.time.toFixed(3) }} ms</span>
            </div>
            <div class="flex flex-wrap items-start gap-x-2 gap-y-1 font-mono text-sm">
              <pre
                v-for="(value, valueIndex) in entry.values"
                :key="valueIndex"
                class="max-w-full whitespace-pre-wrap break-words"
                >{{ value }}</pre>
            </div>
          </li>
        </ol>
      </div>

      <div v-else>
        <div v-if="!state.output.markers.length" class="space-y-3 text-sm text-muted">
          <p>
            No timings yet. Use <code class="text-highlighted">TIME('name')</code>,
            <code class="text-highlighted">TIME('name', callback)</code>, or
            <code class="text-highlighted">console.time('name')</code>.
          </p>
        </div>

        <div v-else>
          <div
            v-for="(marker, index) in state.output.markers"
            :key="`${marker.name}-${index}`"
            class="mb-6 font-mono"
          >
            <div class="mb-1 flex items-center text-sm text-muted">
              <span>{{ marker.time.toFixed(3) }} ms</span>
              <span v-if="index !== 0" class="ml-2" title="Time since the previous marker">
                (+{{ (marker.time - (state.output.markers[index - 1]?.time || 0)).toFixed(3) }}
                ms)
              </span>
            </div>
            <p>
              <span class="font-bold">{{ marker.name }}</span>
              <span v-if="marker.duration !== undefined">
                : {{ marker.duration.toFixed(3) }} ms
              </span>
            </p>
            <div v-if="marker.duration !== undefined" class="relative mt-2">
              <div
                class="striped h-11 rounded-md transition-all duration-500"
                :style="{
                  backgroundColor: colorScale(
                    maxTimerDuration ? marker.duration / maxTimerDuration : 0
                  ).hex(),
                  width: maxTimerDuration ? `${(marker.duration / maxTimerDuration) * 100}%` : '0%',
                }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
