<script setup lang="ts">
import type { Config } from '~/types'
import { BENCHMARK_MODES } from '~/utils/benchmark/modes'
import { BENCHMARK_RUNTIMES } from '~/utils/benchmark/runtimes'

const config = defineModel<Config>({ required: true })
const props = defineProps<{
  isAnyTestRunning: boolean
  isRunningAllTests: boolean
}>()
const emit = defineEmits<{ run: [] }>()
const id = useId()

const benchmarkModeOptions = Object.entries(BENCHMARK_MODES).map(([value, settings]) => ({
  label: `${settings.label} · ${settings.time / 1000}s`,
  value,
}))

const runtimeTabItems = computed(() =>
  Object.entries(BENCHMARK_RUNTIMES).map(([value, settings]) => ({
    label: settings.label,
    value,
    disabled: props.isAnyTestRunning,
  }))
)
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <div class="relative">
      <UTabs
        v-model="config.runtime"
        :items="runtimeTabItems"
        :content="false"
        :ui="{ trigger: 'last:pe-8' }"
        aria-label="Benchmark environment"
        variant="outline"
        size="md"
      />
      <UPopover :content="{ side: 'bottom', align: 'end', sideOffset: 16 }" mode="hover">
        <button
          type="button"
          aria-label="About the DOM runner"
          class="absolute inset-e-3 top-1/2 z-10 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="
            config.runtime === 'dom'
              ? 'text-primary hover:text-primary'
              : 'text-muted hover:text-default'
          "
        >
          <UIcon name="i-tabler-info-circle" class="size-4" aria-hidden="true" />
        </button>

        <template #content>
          <div class="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4 text-sm leading-relaxed">
            <p class="font-semibold text-highlighted">DOM runner</p>
            <p>
              Opens one separate runner window for the run. Benchmark settings control whether cases
              run sequentially or together in parallel.
            </p>
            <p class="text-muted">
              Every case gets a fresh sandboxed iframe with browser APIs such as
              <code class="text-toned">document</code>, layout, and
              <code class="text-toned">Image</code>. The HTML fixture, dependencies, and JavaScript
              setup load before timing begins.
            </p>
            <p class="text-muted">
              Keep the runner visible while testing; browsers may throttle hidden windows and make
              results less reliable.
            </p>
          </div>
        </template>
      </UPopover>
    </div>

    <UFieldGroup size="lg">
      <UButton
        @click="emit('run')"
        :loading="isRunningAllTests"
        :disabled="isAnyTestRunning"
        class="font-semibold"
        icon="i-tabler-play"
        >Run all</UButton
      >
      <UPopover :content="{ side: 'bottom', align: 'end' }">
        <UTooltip text="Benchmark settings">
          <UButton
            aria-label="Benchmark settings"
            class="font-semibold w-8 !p-0 justify-center"
            icon="i-tabler-chevron-down"
          />
        </UTooltip>

        <template #content>
          <div class="w-72 p-4 space-y-4">
            <div>
              <label :for="`${id}-mode`" class="font-medium block mb-2">Run length</label>
              <USelect
                :id="`${id}-mode`"
                v-model="config.benchmarkMode"
                :items="benchmarkModeOptions"
                value-key="value"
                class="w-full"
                :disabled="isRunningAllTests"
              />
              <small class="block leading-normal text-muted mt-2 text-xs">
                Longer runs collect more samples and take longer to complete.
              </small>
            </div>

            <div class="border-t border-default pt-4">
              <div class="flex items-center gap-2">
                <USwitch
                  :id="`${id}-parallel`"
                  v-model="config.parallel"
                  size="sm"
                  :disabled="isRunningAllTests"
                />
                <label :for="`${id}-parallel`" class="font-medium text-nowrap">
                  Run tests in parallel
                </label>
              </div>
              <small
                v-if="config.runtime === 'dom'"
                class="block leading-normal text-muted mt-2 text-xs"
              >
                <template v-if="config.parallel">
                  Cases run together in separate sandboxed frames, but still share the runner's
                  renderer, layout, and memory resources.
                </template>
                <template v-else>
                  Cases run one at a time for more reliable comparisons. Enable this to experiment
                  with parallel DOM execution.
                </template>
              </small>
              <small v-else class="block leading-normal text-muted mt-2 text-xs">
                Faster overall, but workers share CPU, cache, and memory bandwidth. Disable this
                when results are close or inconsistent.
              </small>
            </div>
          </div>
        </template>
      </UPopover>
    </UFieldGroup>
  </div>
</template>
