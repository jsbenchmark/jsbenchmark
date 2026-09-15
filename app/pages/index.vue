<script setup lang="ts">
import { useWebWorkerFn } from '~/utils/worker'
import type { TestCase, Dependency, TestState, Config } from '~/types'
import { nanoid } from 'nanoid'
import { clamp } from '@vueuse/core'
import slugify from 'slugify'
import * as htmlToImage from 'html-to-image'
import type { DropdownMenuItem } from '@nuxt/ui'
import { ADVANCED_EXAMPLE_URL, DEFAULT_TEST_NAME, TARGET_BATCH_TIME } from '~/utils/constants'
import { serialize, deserialize } from '~/utils'
import { getDeviceSpecs } from '~/utils/device'
import { formatBenchmarkResults, type BenchmarkExportFormat } from '~/utils/benchmark/export'
import { runBenchmarkWorker } from '~/utils/benchmark/run'
import { summarizeBenchmark } from '~/utils/benchmark/summary'
import {
  BENCHMARK_MODES,
  DEFAULT_BENCHMARK_MODE,
  resolveBenchmarkMode,
} from '~/utils/benchmark/modes'

const config = ref<Config>({
  benchmarkMode: DEFAULT_BENCHMARK_MODE,
  name: DEFAULT_TEST_NAME,
  parallel: true,
  globalTestConfig: {
    dependencies: [] as Dependency[],
  } as TestCase,
  dataCode: 'return [...Array(1000).keys()]',
})

useHead({
  title: computed(() => config.value.name),
  titleTemplate: (sub) => {
    return sub && sub !== DEFAULT_TEST_NAME ? `${sub} - JS Benchmark` : 'JS Benchmark'
  },
})

const cases = ref<TestCase[]>([
  {
    id: nanoid(),
    code: 'DATA.find(i => i === 99)',
    name: 'Find 99',
    dependencies: [],
  },
  {
    id: nanoid(),
    code: 'DATA.find(i => i === 199)',
    name: 'Find 199',
    dependencies: [],
  },
  {
    id: nanoid(),
    code: 'DATA.find(i => i === 499)',
    name: 'Find 499',
    dependencies: [],
  },
])

const stateByTest = ref<Record<string, TestState>>({})

const compile = useCompile()
const benchmarkModeOptions = Object.entries(BENCHMARK_MODES).map(([value, settings]) => ({
  label: `${settings.label} · ${settings.time / 1000}s`,
  value,
}))

const runCase = async (c: TestCase) => {
  const benchmarkSettings = resolveBenchmarkMode(config.value.benchmarkMode)
  stateByTest.value[c.id] = {
    status: 'running',
    error: null,
    estimatedDurationMs: benchmarkSettings.time + benchmarkSettings.warmupTime,
  }

  const dependencies = [
    ...(config.value.globalTestConfig.dependencies || []),
    ...(c.dependencies || []),
  ].filter((d) => d.url)
  const { workerFn, workerTerminate } = useWebWorkerFn(runBenchmarkWorker, {
    timeout: benchmarkSettings.timeout,
    dependencies: unref(dependencies),
    esm: dependencies.some((d) => d.esm),
  })

  let res
  try {
    const code = await compile.whenEnabled({
      code: c.code,
    })
    const dataCode = await compile.whenEnabled({
      code: config.value.dataCode,
    })

    res = await workerFn({
      code,
      dataCode,
      targetBatchTime: TARGET_BATCH_TIME,
      time: benchmarkSettings.time,
      warmupTime: benchmarkSettings.warmupTime,
      async: c.async,
    })

    stateByTest.value[c.id] = {
      status: 'success',
      error: null,
      result: summarizeBenchmark(res),
    }
  } catch (e) {
    const error =
      e instanceof ErrorEvent
        ? new Error(
            e.type === 'TIMEOUT_EXPIRED'
              ? `The test was canceled because the timeout expired. Check your code for infinite loops and make sure it doesn't take longer than ${benchmarkSettings.timeout / 1000} seconds.`
              : e.type
          )
        : e instanceof Error
          ? e
          : new Error('Unknown error')
    console.error(`Worker failed with error: ${error.message}`)
    stateByTest.value[c.id] = {
      status: 'error',
      error,
      result: undefined,
    }
    workerTerminate()

    if (error.message.toLowerCase().startsWith('unexpected')) {
      usePredefinedNotifications().typescriptHint()
    }
  }
}

const isRunningAllTests = ref(false)
const showStatistics = ref(false)
const benchmarkRunStatus = useBenchmarkRunStatus()

const run = async () => {
  const tests = [...cases.value]
  if (!tests.length) return

  isRunningAllTests.value = true
  const benchmarkSettings = resolveBenchmarkMode(config.value.benchmarkMode)
  benchmarkRunStatus.start({
    estimatedTestDurationMs: benchmarkSettings.time + benchmarkSettings.warmupTime,
    label: benchmarkSettings.label,
    parallel: config.value.parallel,
    totalTests: tests.length,
  })

  try {
    if (config.value.parallel) {
      await Promise.all(tests.map(runCase))
    } else {
      for (const [index, test] of tests.entries()) {
        benchmarkRunStatus.startTest(index + 1)
        await runCase(test)
      }
    }
  } finally {
    const failedTests = tests.filter(
      (test) => stateByTest.value[test.id]?.status === 'error'
    ).length
    benchmarkRunStatus.finish(failedTests)
    isRunningAllTests.value = false
  }
}

const addCase = (insertAtStart = false) => {
  const test = {
    id: nanoid(),
    code: '',
    dependencies: [],
  }
  insertAtStart ? cases.value.unshift(test) : cases.value.push(test)
}
const removeCase = (c: TestCase) => {
  if (!confirm('Are you sure?')) return
  cases.value = cases.value.filter((x) => x !== c)
}

const duplicateCase = (c: TestCase) => {
  const index = cases.value.findIndex((t) => t.id === c.id)
  const nameWithoutCopy = c.name?.replace(/ \(copy(?: \d+)?\)$/, '') || c.name || ''
  const countWithSameName =
    cases.value.filter((t) => t.name?.startsWith(nameWithoutCopy)).length - 1
  const name = countWithSameName
    ? `${nameWithoutCopy} (copy ${countWithSameName})`
    : `${nameWithoutCopy} (copy)`

  cases.value.splice(index + 1, 0, {
    ...c,
    id: nanoid(),
    name,
  })
}

const route = useRoute()

const isAnyTestRunning = computed(() => {
  return cases.value.some((c) => {
    const state = stateByTest.value[c.id]
    return state?.status === 'running'
  })
})

const allTestsHaveResults = computed(() => {
  return cases.value.every((c) => {
    const state = stateByTest.value[c.id]
    return state?.status === 'success' || state?.status === 'error'
  })
})

const someTestsHaveResults = computed(() => {
  return cases.value.some((c) => {
    const state = stateByTest.value[c.id]
    return state?.status === 'success' || state?.status === 'error'
  })
})

const exportViewRef = ref<HTMLElement | null>(null)
const isExporting = ref(false)
const exportDeviceSpecs = ref('')
const resultsClipboard = useClipboard({ legacy: true })
const toast = useToast()

const exportResults = async () => {
  isExporting.value = true
  try {
    exportDeviceSpecs.value = await getDeviceSpecs()
    await nextTick()

    // Fix fonts: https://github.com/bubkoo/html-to-image/issues/49#issuecomment-762222100
    await document.fonts.ready
    const fontEmbedCSS = await htmlToImage.getFontEmbedCSS(exportViewRef.value!)
    const dataUrl = await htmlToImage.toPng(exportViewRef.value!, {
      canvasWidth: 1600 * 2,
      canvasHeight: 900 * 2,
      fontEmbedCSS,
    })
    const link = document.createElement('a')
    link.download = `${slugify(config.value.name).toLowerCase()}.png`
    link.href = dataUrl
    link.click()
  } catch {
    toast.add({
      title: 'Image export failed',
      description: 'The results could not be rendered as an image.',
      closeIcon: 'i-tabler-x',
      color: 'error',
      icon: 'i-tabler-alert-circle',
    })
  } finally {
    setTimeout(() => {
      isExporting.value = false
    }, 1000)
  }
}

const copyResults = async (format: BenchmarkExportFormat) => {
  await resultsClipboard.copy(
    formatBenchmarkResults(config.value.name, cases.value, stateByTest.value, format)
  )
  toast.add({
    title: `Copied as ${format === 'markdown' ? 'Markdown' : format.toUpperCase()}`,
    description: 'Benchmark results and statistics are ready to paste.',
    closeIcon: 'i-tabler-x',
    color: 'success',
    duration: 2_500,
    icon: 'i-tabler-clipboard-check',
  })
}

const exportItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: 'Download image',
      description: allTestsHaveResults.value ? 'Save results as PNG' : 'Run all tests first',
      icon: 'i-tabler-photo-down',
      disabled: !cases.value.length || !allTestsHaveResults.value || isExporting.value,
      loading: isExporting.value,
      onSelect: () => void exportResults(),
    },
  ],
  [
    { type: 'label', label: 'Copy results' },
    {
      label: 'Markdown',
      icon: 'i-tabler-markdown',
      disabled: !someTestsHaveResults.value,
      onSelect: () => void copyResults('markdown'),
    },
    {
      label: 'CSV',
      icon: 'i-tabler-file-type-csv',
      disabled: !someTestsHaveResults.value,
      onSelect: () => void copyResults('csv'),
    },
    {
      label: 'JSON',
      icon: 'i-tabler-json',
      disabled: !someTestsHaveResults.value,
      onSelect: () => void copyResults('json'),
    },
  ],
])

const clear = () => {
  if (!confirm('Clear everything. Are you sure?')) return
  cases.value = []
  config.value = {
    benchmarkMode: DEFAULT_BENCHMARK_MODE,
    name: '',
    parallel: true,
    dataCode: '',
    globalTestConfig: {
      dependencies: [] as Dependency[],
    } as TestCase,
  }
}

// Read state from URL.
onMounted(() => {
  const urlState = deserialize(route.hash.slice(1))

  if (urlState) {
    cases.value = urlState.cases
    config.value = {
      ...urlState.config,
      benchmarkMode: resolveBenchmarkMode(urlState.config.benchmarkMode).mode,
    }
  }
})

// Write state to URL.
watch(
  [cases, config],
  () => {
    const encoded = serialize({
      cases: cases.value,
      config: config.value,
    })

    useRouter().replace({
      hash: `#${encoded}`,
    })
  },
  { deep: true }
)
</script>

<template>
  <div>
    <SplitLayout>
      <template #default>
        <div class="flex-col lg:flex-row flex justify-between lg:items-start">
          <UTextarea
            v-model="config.name"
            placeholder="Name"
            class="font-bold flex-1 max-w-full"
            autoresize
            :ui="{ base: 'p-0' }"
            variant="none"
            size="4xl"
            :rows="1"
          />

          <div class="mt-8 lg:ml-10 lg:mt-1.5 flex gap-3 items-center">
            <UTooltip text="Clear">
              <UButton
                @click="clear"
                color="neutral"
                variant="outline"
                icon="i-tabler-trash"
                size="lg"
              />
            </UTooltip>
            <ShareButton :payload="{ config, cases }" type="benchmark" />

            <UFieldGroup size="lg">
              <UButton
                @click="run"
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
                      <label for="benchmark-mode" class="font-medium block mb-2">Run length</label>
                      <USelect
                        id="benchmark-mode"
                        v-model="config.benchmarkMode"
                        :items="benchmarkModeOptions"
                        value-key="value"
                        class="w-full"
                        :disabled="isRunningAllTests"
                      />
                      <small class="block leading-normal text-gray-400 mt-2 text-xs">
                        Longer runs collect more samples and take longer to complete.
                      </small>
                    </div>

                    <div class="border-t border-gray-800 pt-4">
                      <div class="flex items-center gap-2">
                        <USwitch
                          id="parallel-tests"
                          v-model="config.parallel"
                          size="sm"
                          :disabled="isRunningAllTests"
                        />
                        <label for="parallel-tests" class="font-medium text-nowrap">
                          Run tests in parallel
                        </label>
                      </div>
                      <small class="block leading-normal text-gray-400 mt-2 text-xs">
                        Faster overall, but workers share CPU, cache, and memory bandwidth. Disable
                        this when results are close or inconsistent.
                      </small>
                    </div>
                  </div>
                </template>
              </UPopover>
            </UFieldGroup>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <h3 class="text-2xl font-bold">Setup</h3>
          <p class="text-gray-400 text-sm">
            This setup function should return the stuff you need in the tests. Anything returned
            will be available via the
            <code class="text-white">DATA</code>
            variable inside the test cases. Running the setup function is not part of the benchmark
            and it's run separately for each test case. To learn more, check out
            <a
              class="font-medium transition hover:text-white text-sm underline"
              target="_blank"
              :href="ADVANCED_EXAMPLE_URL"
            >
              this more advanced example </a
            >. Note that all snippets can be authored in TypeScript when experimental support is
            enabled.
          </p>
          <BaseCodeEditor v-model="config.dataCode" />
          <DependencyList v-model:test="config.globalTestConfig" show-hint global class="mt-2">
            <template #help>
              <p>Global dependencies are available in the setup function and every test case.</p>
            </template>
          </DependencyList>
        </div>

        <div class="flex justify-between items-center !mt-10">
          <h3 class="text-2xl font-bold">
            Test cases <span class="font-normal text-gray-500 text-xl">({{ cases.length }})</span>
          </h3>
          <div>
            <UButton
              icon="i-tabler-plus"
              variant="outline"
              @click="addCase(true)"
              color="neutral"
              size="lg"
            >
              Add case
            </UButton>
          </div>
        </div>

        <TestCases
          v-model="cases"
          :state-by-test="stateByTest"
          :config="config"
          @run="runCase"
          @remove="removeCase"
          @duplicate="duplicateCase"
        />

        <div>
          <UButton
            icon="i-tabler-plus"
            variant="outline"
            @click="addCase(false)"
            color="neutral"
            block
            size="md"
          >
            Add case
          </UButton>
        </div>

        <div
          v-if="isExporting"
          class="fixed -left-[1000000px] pointer-events-none flex items-center justify-center"
        >
          <div
            ref="exportViewRef"
            class="relative w-[1600px] h-[900px] rounded-xl bg-gray-900 p-20 flex flex-col justify-center font-sans"
            :style="{
              fontSize: `${clamp(40 * (2 / Math.max(cases.length, 2)) * 0.95, 10, 35)}px`,
            }"
          >
            <h1 class="font-extrabold text-[2.6em] mb-[1em] leading-none">
              {{ config.name }}
            </h1>
            <Results :cases="cases" :state-by-test="stateByTest" />
            <div
              class="absolute top-0 right-0 bg-gray-800 rounded-bl-md rounded-tr-xl text-xs px-3.5 py-1.5 text-gray-400 tracking-wide font-medium"
            >
              <span>Powered by</span>
              <span class="text-gray-300 inline-block ml-1">jsbenchmark.com</span>
            </div>
            <div
              data-export-device-specs
              class="absolute inset-x-0 bottom-0 bg-gray-800 rounded-b-xl text-xs px-6 py-2 text-center text-gray-400 tracking-wide font-medium"
            >
              <span class="text-gray-300">Device:</span>
              <span class="ml-1">{{ exportDeviceSpecs }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #sidebar>
        <div class="flex flex-wrap justify-between items-center gap-3 mb-12">
          <h2 class="text-3xl font-bold shrink-0">Results</h2>
          <div class="flex items-center gap-2">
            <UButton
              :disabled="!someTestsHaveResults"
              :aria-pressed="showStatistics"
              :color="showStatistics ? 'primary' : 'neutral'"
              :variant="showStatistics ? 'soft' : 'outline'"
              @click="showStatistics = !showStatistics"
            >
              Statistics
            </UButton>
            <UDropdownMenu :items="exportItems" :content="{ side: 'bottom', align: 'end' }">
              <UButton
                :loading="isExporting"
                :disabled="!someTestsHaveResults || isExporting"
                color="neutral"
                variant="outline"
                trailing-icon="i-tabler-chevron-down"
              >
                Export
              </UButton>
            </UDropdownMenu>
          </div>
        </div>

        <Results :cases="cases" :state-by-test="stateByTest" :show-statistics="showStatistics" />

        <div class="mt-20 text-gray-400 text-[0.8rem] space-y-2">
          <p>
            <span class="font-bold">Note:</span> Each test is warmed up, measured in timed batches,
            and summarized using the actual elapsed time. Tests run in parallel unless disabled.
          </p>
          <p>
            Each test runs in a separate web worker. This means that the actual ops/s might be
            higher in a real-world scenario. Results are most useful for comparing cases within this
            run and can vary with CPU load, JIT compilation, garbage collection, and concurrent
            workers.
          </p>
        </div>
      </template>
    </SplitLayout>
  </div>
</template>

<style>
:root {
  color-scheme: dark;
}

input {
  max-width: none;
}

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
