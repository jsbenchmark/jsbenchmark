<script setup lang="ts">
import { useWebWorkerFn } from '~/utils/worker'
import '@fontsource-variable/jetbrains-mono'
import type { TestCase, Dependency, TestState } from '~/types'
import { nanoid } from 'nanoid'
import { clamp } from '@vueuse/core'
import slugify from 'slugify'
import * as htmlToImage from 'html-to-image'
import '@fontsource-variable/pathway-extreme'
import {
  ADVANCED_EXAMPLE_URL,
  DEFAULT_TEST_NAME,
  TEST_TIME,
  TEST_TIMEOUT,
  WARMUP_TIME,
} from '~/utils/constants'
import { serialize, deserialize } from '~/utils'

definePageMeta({
  layout: false,
})

const config = ref({
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
    code: 'DATA.find(i => i === 499)',
    name: 'Find 499',
    dependencies: [],
  },
  {
    id: nanoid(),
    code: 'DATA.find(i => i === 999)',
    name: 'Find 999',
    dependencies: [],
  },
])

const stateByTest = ref<Record<string, TestState>>({})

const runCase = async (c: TestCase) => {
  stateByTest.value[c.id] = {
    status: 'running',
    error: null,
  }

  const dependencies = [
    ...(config.value.globalTestConfig.dependencies || []),
    ...(c.dependencies || []),
  ].filter((d) => d.url)

  const { workerFn, workerTerminate } = useWebWorkerFn(
    async ({ code, dataCode, time, warmupTime }, d?: any) => {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

      const dataFn = AsyncFunction(dataCode)
      const data = await dataFn(d)
      ;(globalThis as any).DATA = data

      const fn = AsyncFunction(code)

      // Warmup.
      let warmupTimes = 0
      const warmupStart = performance.now()

      while (performance.now() - warmupStart < warmupTime) {
        await fn()
        warmupTimes++
      }

      // Actual test.
      let times = 0
      const start = performance.now()

      while (performance.now() - start < time) {
        await fn()
        times++
      }

      return {
        times,
      }
    },
    {
      timeout: TEST_TIMEOUT,
      dependencies: unref(dependencies),
      esm: dependencies.some((d) => d.esm),
    }
  )

  let res
  try {
    res = await workerFn({
      code: c.code,
      dataCode: config.value.dataCode,
      time: TEST_TIME,
      warmupTime: WARMUP_TIME,
    })

    const opsPerSecond = Math.round(res.times / (TEST_TIME / 1000))

    const averageTime = 1000 / opsPerSecond
    let averageTimeFormatted = averageTime.toFixed(2)

    const isSubSecond = averageTime < 1
    if (isSubSecond) {
      const zeroCountAfterDot = averageTime.toString().match(/\.(0+)/)?.[1].length
      averageTimeFormatted = averageTime.toFixed((zeroCountAfterDot || 0) + 2)
    }

    stateByTest.value[c.id] = {
      status: 'success',
      error: null,
      result: {
        opsPerSecond,
        averageTime,
        averageTimeFormatted,
      },
    }
  } catch (e) {
    const error = ((e as Error).message ? e : new Error('Unknown error')) as Error
    console.error(`Worker failed with error: ${error.message}`)
    stateByTest.value[c.id] = {
      status: 'error',
      error: error,
      result: undefined,
    }
    workerTerminate()
  }
}

const isRunningAllTests = ref(false)

const run = async () => {
  isRunningAllTests.value = true
  if (config.value.parallel) {
    await Promise.all(cases.value.map(runCase))
  } else {
    for (const c of cases.value) {
      await runCase(c)
    }
  }
  isRunningAllTests.value = false
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

const exportViewRef = ref<HTMLElement | null>(null)
const isExporting = ref(false)

const exportResults = async () => {
  isExporting.value = true
  await nextTick()

  // Fix fonts: https://github.com/bubkoo/html-to-image/issues/49#issuecomment-762222100
  const dataUrl = await htmlToImage.toPng(exportViewRef.value!, {
    canvasWidth: 1600 * 2,
    canvasHeight: 900 * 2,
  })
  const link = document.createElement('a')
  link.download = `${slugify(config.value.name).toLowerCase()}.png`
  link.href = dataUrl
  link.click()

  setTimeout(() => {
    isExporting.value = false
  }, 1000)
}

const clear = () => {
  if (!confirm('Clear everything. Are you sure?')) return
  cases.value = []
  config.value = {
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
    config.value = urlState.config
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
    <NuxtLayout name="default">
      <template #default>
        <div class="flex-col lg:flex-row flex justify-between lg:items-start">
          <UTextarea
            v-model="config.name"
            placeholder="Name"
            class="font-bold flex-1 max-w-full"
            autoresize
            :padded="false"
            variant="none"
            size="4xl"
            :rows="1"
          />

          <div class="mt-8 lg:ml-10 lg:mt-1.5 flex gap-3 items-center">
            <UButton @click="clear" color="white" icon="i-tabler-trash" size="lg" />
            <ShareButton :payload="{ config, cases }" type="benchmark" />
            <UButton
              @click="run"
              :loading="isRunningAllTests"
              :disabled="isAnyTestRunning"
              size="lg"
              class="font-semibold"
              icon="i-tabler-play"
              >Run all</UButton
            >
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
            >.
          </p>
          <BaseCodeEditor v-model="config.dataCode" />
          <DependencyList v-model:test="config.globalTestConfig" show-hint global class="mt-2">
            <template #help>
              <p>Global dependencies are available in the setup function and every test case.</p>
            </template>
          </DependencyList>
        </div>

        <div class="flex justify-between items-center !mt-10">
          <h3 class="text-2xl font-bold">Test cases</h3>
          <div>
            <UButton icon="i-tabler-plus" outline @click="addCase(true)" color="white" size="lg">
              Add case
            </UButton>
          </div>
        </div>

        <TransitionGroup name="list" class="relative flex flex-col gap-8" tag="div">
          <div
            v-for="(c, index) of cases"
            :key="c.id"
            class="border rounded-xl border-gray-800 p-6 flex flex-col gap-4 bg-gray-900"
          >
            <div class="flex-col lg:flex-row flex lg:items-center justify-between">
              <UInput
                :padded="false"
                variant="none"
                v-model="c.name"
                placeholder="Name"
                class="font-semibold flex-1 mr-8"
                size="xl"
              />
              <div class="flex lg:justify-end items-center space-x-4 h-10">
                <div
                  class="rounded-md h-full px-0 lg:mr-2 -border -bg-gray-800 flex items-center mr-auto"
                >
                  <div class="flex items-center font-mono space-x-2 text-sm">
                    <div class="text-gray-400">Ops/s:</div>
                    <div>
                      {{
                        stateByTest[c.id]?.result
                          ? Number(stateByTest[c.id]?.result?.opsPerSecond).toLocaleString()
                          : '?'
                      }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <UButton
                    @click="runCase(c)"
                    :loading="stateByTest[c.id]?.status === 'running'"
                    outline
                    color="white"
                    size="md"
                    >Run</UButton
                  >
                  <UButton
                    @click="removeCase(c)"
                    outline
                    color="white"
                    icon="i-tabler-trash"
                    size="md"
                  />
                </div>
              </div>
            </div>
            <BaseCodeEditor v-model="c.code" @run="runCase(c)" />

            <DependencyList
              v-model:test="cases[index]"
              :name-index-offset="config.globalTestConfig.dependencies?.length || 0"
            />

            <UAlert
              v-if="stateByTest[c.id]?.status === 'error'"
              icon="i-tabler-alert-circle"
              color="red"
              variant="subtle"
              title="Error"
              :description="stateByTest[c.id]?.error?.message"
            />
          </div>
        </TransitionGroup>

        <div class="mt-6">
          <UButton
            icon="i-tabler-plus"
            outline
            @click="addCase(false)"
            color="white"
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
            class="w-[1600px] h-[900px] rounded-xl bg-gray-900 p-20 flex flex-col justify-center"
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
          </div>
        </div>
      </template>
      <template #sidebar>
        <div class="flex justify-between items-center mb-12">
          <h2 class="text-3xl font-bold">Results</h2>
          <div>
            <UTooltip
              :text="
                !cases.length || !allTestsHaveResults
                  ? 'Run all tests to enable the image export'
                  : 'Export tests results as a nice image'
              "
            >
              <UButton
                @click="exportResults"
                :loading="isExporting"
                :disabled="!cases.length || !allTestsHaveResults"
                color="white"
                >Export image</UButton
              >
            </UTooltip>
          </div>
        </div>

        <Results :cases="cases" :state-by-test="stateByTest" />

        <div class="mt-24 text-gray-400 text-sm">
          <p>
            <span class="font-bold">Note:</span> No statistical analysis is used to validate the
            results. The tests are run in parallel for 3 seconds (with a 500ms warmup) and then
            operations per second are calculated.
          </p>
        </div>
      </template>
    </NuxtLayout>
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
