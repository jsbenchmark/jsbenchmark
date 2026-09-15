<script setup lang="ts">
import type { TestCase, Dependency, TestState, Config } from '~/types'
import { nanoid } from 'nanoid'
import { clamp } from '@vueuse/core'
import slugify from 'slugify'
import * as htmlToImage from 'html-to-image'
import type { DropdownMenuItem } from '@nuxt/ui'
import { ADVANCED_EXAMPLE_URL, DEFAULT_TEST_NAME } from '~/utils/constants'
import { serialize, deserialize } from '~/utils'
import { getDeviceSpecs } from '~/utils/device'
import { formatBenchmarkResults, type BenchmarkExportFormat } from '~/utils/benchmark/export'
import {
  createBenchmarkExampleCases,
  DEFAULT_WORKER_BENCHMARK_EXAMPLE,
  getBenchmarkExampleForRuntimeChange,
} from '~/utils/benchmark/examples'
import { DEFAULT_BENCHMARK_MODE, resolveBenchmarkMode } from '~/utils/benchmark/modes'
import {
  DEFAULT_BENCHMARK_RUNTIME,
  normalizeSetupHtml,
  resolveBenchmarkRuntime,
} from '~/utils/benchmark/runtimes'

const config = ref<Config>({
  benchmarkMode: DEFAULT_BENCHMARK_MODE,
  runtime: DEFAULT_BENCHMARK_RUNTIME,
  name: DEFAULT_WORKER_BENCHMARK_EXAMPLE.name,
  parallel: true,
  globalTestConfig: {
    dependencies: [] as Dependency[],
  } as TestCase,
  dataCode: DEFAULT_WORKER_BENCHMARK_EXAMPLE.dataCode,
  setupHtml: DEFAULT_WORKER_BENCHMARK_EXAMPLE.setupHtml,
})

useHead({
  title: computed(() => config.value.name),
  titleTemplate: (sub) => {
    return sub && sub !== DEFAULT_TEST_NAME ? `${sub} - JS Benchmark` : 'JS Benchmark'
  },
})

const cases = ref<TestCase[]>(createBenchmarkExampleCases(DEFAULT_WORKER_BENCHMARK_EXAMPLE, nanoid))

const stateByTest = ref<Record<string, TestState>>({})

const setupEditorTab = ref<'javascript' | 'html'>('javascript')
const setupTabItems = [
  { label: 'JavaScript / TypeScript', value: 'javascript' },
  { label: 'HTML fixture', value: 'html' },
]

const { isAnyTestRunning, isRunningAllTests, run, runCase } = useBenchmarkExecution({
  cases,
  config,
  stateByTest,
})

const showStatistics = ref(false)

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

const isHtmlSetupActive = computed(
  () => config.value.runtime === 'dom' && setupEditorTab.value === 'html'
)

watch(
  () => config.value.runtime,
  (runtime) => {
    const example = getBenchmarkExampleForRuntimeChange(config.value, cases.value, runtime)
    if (!example) return

    config.value = {
      ...config.value,
      name: example.name,
      dataCode: example.dataCode,
      setupHtml: example.setupHtml,
    }
    const existingIds = cases.value.map((test) => test.id)
    cases.value = createBenchmarkExampleCases(example, () => existingIds.shift() ?? nanoid())
    setupEditorTab.value = runtime === 'dom' ? 'html' : 'javascript'
  }
)

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
const includeStatisticsInImage = ref(false)
const includeDeviceSpecsInImage = ref(true)
const exportDeviceSpecs = ref('')
const resultsClipboard = useClipboard({ legacy: true })
const toast = useToast()
const colorMode = useColorMode()

const exportResults = async () => {
  isExporting.value = true
  try {
    exportDeviceSpecs.value = includeDeviceSpecsInImage.value ? await getDeviceSpecs() : ''
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
    {
      type: 'checkbox',
      slot: 'statistics',
      class: 'ps-8',
      label: 'Include statistics',
      description: 'Add median, p95, deviation, and RME',
      checked: includeStatisticsInImage.value,
      onUpdateChecked: (checked) => {
        includeStatisticsInImage.value = checked
      },
      onSelect: (event) => {
        event.preventDefault()
      },
    },
    {
      type: 'checkbox',
      slot: 'device-specs',
      class: 'ps-8',
      label: 'Include device specs',
      description: 'Add available platform and hardware details',
      checked: includeDeviceSpecsInImage.value,
      onUpdateChecked: (checked) => {
        includeDeviceSpecsInImage.value = checked
      },
      onSelect: (event) => {
        event.preventDefault()
      },
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
    runtime: DEFAULT_BENCHMARK_RUNTIME,
    name: '',
    parallel: true,
    dataCode: '',
    setupHtml: '',
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
      runtime: resolveBenchmarkRuntime(urlState.config.runtime),
      setupHtml: normalizeSetupHtml(urlState.config.setupHtml),
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

          <div class="mt-8 lg:ml-10 lg:mt-1.5 flex flex-col items-start lg:items-end gap-2">
            <div class="flex flex-wrap gap-3 items-center">
              <UTooltip text="Clear">
                <UButton
                  @click="clear"
                  :disabled="isAnyTestRunning"
                  aria-label="Clear benchmark"
                  color="neutral"
                  variant="outline"
                  icon="i-tabler-trash"
                  size="lg"
                />
              </UTooltip>
              <ShareButton :payload="{ config, cases }" type="benchmark" />

              <div class="min-w-0 max-w-full">
                <BenchmarkRunControls
                  v-model="config"
                  :is-any-test-running="isAnyTestRunning"
                  :is-running-all-tests="isRunningAllTests"
                  @run="run"
                />
              </div>
            </div>
          </div>
        </div>

        <hr class="dark:border-neutral-800 border-neutral-200" />

        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-2xl font-bold">Setup</h3>
            <UTabs
              v-model="setupEditorTab"
              :items="setupTabItems"
              :content="false"
              :class="{
                'invisible pointer-events-none': config.runtime !== 'dom',
              }"
              :aria-hidden="config.runtime !== 'dom'"
              :inert="config.runtime !== 'dom'"
              aria-label="Setup editor"
              variant="outline"
              size="sm"
            />
          </div>
          <div class="grid text-sm text-muted">
            <div
              class="[grid-area:1/1] flex flex-wrap items-center gap-x-2 gap-y-1"
              :class="{ 'invisible pointer-events-none': isHtmlSetupActive }"
              :aria-hidden="isHtmlSetupActive"
              :inert="isHtmlSetupActive"
            >
              <p>
                Return the data your tests need. It will be available as
                <code class="text-highlighted">DATA</code>
                in every test case.
              </p>
              <UPopover :content="{ side: 'bottom', align: 'start' }" mode="hover">
                <UButton
                  color="neutral"
                  variant="link"
                  size="xs"
                  icon="i-tabler-info-circle"
                  class="p-0 font-medium"
                >
                  Details
                </UButton>

                <template #content>
                  <div class="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4 text-sm leading-normal">
                    <p>
                      Setup runs separately for each test case and is excluded from the benchmark
                      timing.
                    </p>
                    <p class="text-muted">
                      All snippets can use TypeScript when experimental support is enabled.
                    </p>
                    <a
                      class="inline-flex font-medium underline transition hover:text-highlighted"
                      target="_blank"
                      rel="noreferrer"
                      :href="ADVANCED_EXAMPLE_URL"
                    >
                      View an advanced example
                    </a>
                  </div>
                </template>
              </UPopover>
            </div>
            <p
              class="[grid-area:1/1] self-start leading-normal"
              :class="{ 'invisible pointer-events-none': !isHtmlSetupActive }"
              :aria-hidden="!isHtmlSetupActive"
            >
              Optional body markup inserted before JavaScript setup. Setup is excluded from
              benchmark timing.
            </p>
          </div>
          <div class="grid">
            <div
              class="[grid-area:1/1]"
              :class="{ 'invisible pointer-events-none': isHtmlSetupActive }"
              :aria-hidden="isHtmlSetupActive"
              :inert="isHtmlSetupActive"
            >
              <BaseCodeEditor v-model="config.dataCode" language="javascript" />
            </div>
            <div
              class="[grid-area:1/1]"
              :class="{ 'invisible pointer-events-none': !isHtmlSetupActive }"
              :aria-hidden="!isHtmlSetupActive"
              :inert="!isHtmlSetupActive"
            >
              <BaseCodeEditor v-model="config.setupHtml" language="html" />
            </div>
          </div>
          <DependencyList v-model:test="config.globalTestConfig" show-hint global class="mt-2">
            <template #help>
              <p>Global dependencies are available in the setup function and every test case.</p>
            </template>
          </DependencyList>
        </div>

        <hr class="dark:border-neutral-800 border-neutral-200" />

        <div class="flex justify-between items-center">
          <h3 class="text-2xl font-bold">
            Test cases <span class="font-normal text-muted text-xl">({{ cases.length }})</span>
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
          :disable-run="config.runtime === 'dom' && isAnyTestRunning"
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
            class="relative w-[1600px] h-[900px] rounded-xl bg-default text-highlighted p-20 flex flex-col justify-center font-sans"
            :class="colorMode.value === 'dark' ? 'dark' : 'light'"
            :style="{
              fontSize: `${clamp(40 * (2 / Math.max(cases.length, 2)) * 0.95, 10, 35)}px`,
            }"
          >
            <h1 class="font-extrabold text-[2.6em] mb-[1em] leading-none">
              {{ config.name }}
            </h1>
            <Results
              :cases="cases"
              :state-by-test="stateByTest"
              :show-summary-statistics="includeStatisticsInImage"
            />
            <div
              class="absolute top-0 right-0 bg-muted rounded-bl-md rounded-tr-xl text-xs px-3.5 py-1.5 text-muted tracking-wide font-medium"
            >
              <span>Powered by</span>
              <span class="text-toned inline-block ml-1">jsbenchmark.com</span>
            </div>
            <div
              v-if="includeDeviceSpecsInImage"
              class="absolute inset-x-0 bottom-0 bg-muted rounded-b-xl text-xs px-6 py-2 text-center text-muted tracking-wide font-medium"
            >
              <span class="text-toned">Device:</span>
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

              <template #statistics>
                <span class="flex flex-col gap-1.5">
                  <span class="flex items-center gap-2">
                    <USwitch
                      :model-value="includeStatisticsInImage"
                      size="sm"
                      tabindex="-1"
                      aria-hidden="true"
                      class="pointer-events-none shrink-0"
                    />
                    <span class="font-medium">Include statistics</span>
                  </span>
                  <span class="text-xs text-muted">Add median, p95, deviation, and RME</span>
                </span>
              </template>

              <template #device-specs>
                <span class="flex flex-col gap-1.5">
                  <span class="flex items-center gap-2">
                    <USwitch
                      :model-value="includeDeviceSpecsInImage"
                      size="sm"
                      tabindex="-1"
                      aria-hidden="true"
                      class="pointer-events-none shrink-0"
                    />
                    <span class="font-medium">Include device specs</span>
                  </span>
                  <span class="text-xs text-muted">
                    Add available platform and hardware details
                  </span>
                </span>
              </template>
            </UDropdownMenu>
          </div>
        </div>

        <Results :cases="cases" :state-by-test="stateByTest" :show-statistics="showStatistics" />

        <div class="mt-16 text-[0.8rem] leading-normal text-muted">
          Compare cases within the same run. Absolute performance may
          <span class="inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
            <span>vary between runs.</span>
            <UPopover :content="{ side: 'top', align: 'end' }" mode="hover">
              <UButton
                color="neutral"
                variant="link"
                size="xs"
                icon="i-tabler-info-circle"
                class="p-0 font-medium"
              >
                Methodology
              </UButton>

              <template #content>
                <div class="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4 text-sm leading-normal">
                  <p class="font-semibold">How results are measured</p>
                  <p>
                    Tests are warmed up, then measured in timed batches using the actual elapsed
                    time. Statistics summarize per-operation batch averages, not individual calls.
                  </p>
                  <p v-if="config.runtime === 'worker'" class="text-muted">
                    Each test uses its own web worker. Tests run in parallel by default, so workers
                    share CPU, cache, and memory bandwidth.
                  </p>
                  <p v-else class="text-muted">
                    DOM tests run in fresh visible sandboxed frames inside one separate runner
                    window. They run {{ config.parallel ? 'in parallel' : 'sequentially' }}; HTML
                    and JavaScript setup run before timing starts.
                  </p>
                  <p class="text-muted">
                    CPU load, JIT compilation, and garbage collection can affect absolute ops/s.
                    <template v-if="config.runtime === 'dom'">
                      Hidden or minimized runner windows may also have throttled timers and
                      animation frames.
                    </template>
                  </p>
                </div>
              </template>
            </UPopover>
          </span>
        </div>
      </template>
    </SplitLayout>
  </div>
</template>

<style>
input {
  max-width: none;
}

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

@keyframes stripes-animation {
  0% {
    background-position: 0 0;
  }

  100% {
    background-position: 2rem 0;
  }
}
</style>
