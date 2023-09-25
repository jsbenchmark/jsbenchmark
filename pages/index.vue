<script setup lang="ts">
import { useWebWorkerFn } from '~/utils/worker'
import '@fontsource-variable/jetbrains-mono'
import { TestCase, Dependency, TestState } from '~/types'
import { nanoid } from 'nanoid'
import { clamp } from '@vueuse/core'
import slugify from 'slugify'
import * as htmlToImage from 'html-to-image'
import { IconCheck, IconLink, IconTrash, IconPlus } from '@tabler/icons-vue'
import '@fontsource-variable/pathway-extreme'
import {
  ADVANCED_EXAMPLE_URL,
  DEFAULT_TEST_NAME,
  TEST_TIME,
  TEST_TIMEOUT,
  WARMUP_TIME,
} from '~/utils/constants'
import { getUrl, serialize, deserialize } from '~/utils'

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
  htmlAttrs: {
    class: 'bg-gray-900 text-white font-sans overflow-x-hidden',
  },
})

useServerSeoMeta({
  ogTitle: 'JS Benchmark',
  description:
    'A straightforward JavaScript benchmarking tool with support for ES modules and libraries.',
  ogDescription:
    'A straightforward JavaScript benchmarking tool with support for ES modules and libraries.',
  keywords:
    'javascript, benchmark, js, performance, esm, module, library, measure, compare, testing, tool',
  author: 'pabue.co',
  ogImage: 'https://jsbenchmark.com/og.png',
  twitterCard: 'summary_large_image',
})

const clipboard = useClipboard()
const { share, isSupported: isShareSupported } = useShare()

function startShare() {
  share({
    title: 'jsbenchmark.com',
    text: `Check out this benchmark on jsbenchmark.com!`,
    url: getUrl(),
  })
}

const cases = ref<TestCase[]>([
  {
    id: nanoid(),
    code: 'DATA.find(i => i === 99)',
    name: 'Find 99',
  },
  {
    id: nanoid(),
    code: 'DATA.find(i => i === 499)',
    name: 'Find 499',
  },
  {
    id: nanoid(),
    code: 'DATA.find(i => i === 999)',
    name: 'Find 999',
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

const addCase = () => {
  cases.value.push({
    id: nanoid(),
    code: '',
    dependencies: [],
  })
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
  <NuxtLayout name="default">
    <template #default>
      <div class="flex-col lg:flex-row flex justify-between lg:items-start">
        <BaseInput
          v-model="config.name"
          placeholder="Name"
          blendin
          class="text-[2.3rem] font-bold flex-1 max-w-full"
          type="textarea"
        />

        <div class="mt-8 lg:ml-10 lg:mt-1.5 h-[50px] flex gap-3">
          <BaseButton
            @click="isShareSupported ? startShare() : clipboard.copy(getUrl())"
            :disabled="isAnyTestRunning"
            class="!px-0 aspect-square"
            outline
          >
            <IconLink v-if="!clipboard.copied.value" />
            <IconCheck v-else />
          </BaseButton>
          <BaseButton
            @click="run"
            :loading="isRunningAllTests"
            :disabled="isAnyTestRunning"
            class="text-lg px-6 flex-1 lg:flex-auto"
            >Run all</BaseButton
          >
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="text-2xl font-bold">Setup</h3>
        <p class="text-gray-400 text-sm">
          This setup function should return the stuff you need in the tests. Anything returned will
          be available via the
          <code class="text-white">DATA</code>
          variable inside the test cases. Running the setup function is not part of the benchmark
          and it's run separately for each test case.
        </p>
        <BaseCodeEditor v-model="config.dataCode" />
        <Dependencies v-model:test="config.globalTestConfig" global class="mt-2">
          <template #help>
            <p>Global dependencies are available in the setup function and every test case.</p>
          </template>
        </Dependencies>
      </div>

      <div class="flex justify-between items-center">
        <h3 class="text-2xl font-bold">Test cases</h3>
        <div>
          <BaseButton :icon="IconPlus" outline @click="addCase">
            <span>Add case</span>
          </BaseButton>
        </div>
      </div>

      <div
        v-for="(c, index) of cases"
        :key="index"
        class="border rounded-xl border-gray-800 p-6 flex flex-col gap-4"
      >
        <div class="flex-col lg:flex-row flex lg:items-center justify-between">
          <BaseInput v-model="c.name" placeholder="Name" blendin class="text-xl font-semibold" />
          <div class="flex lg:justify-end space-x-4 h-10">
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
            <BaseButton
              @click="runCase(c)"
              :loading="stateByTest[c.id]?.status === 'running'"
              outline
              >Run</BaseButton
            >
            <BaseButton
              @click="removeCase(c)"
              class="!bg-transparent border border-gray-700 px-0 aspect-square text-gray-400"
            >
              <IconTrash :size="20" />
            </BaseButton>
          </div>
        </div>
        <BaseCodeEditor v-model="c.code" />

        <Dependencies
          v-model:test="cases[index]"
          :name-index-offset="config.globalTestConfig.dependencies?.length || 0"
        />

        <div
          v-if="stateByTest[c.id]?.status === 'error'"
          class="bg-red-600/10 text-red-500 rounded-md px-4 py-3 font-mono border border-red-600"
        >
          {{ stateByTest[c.id]?.error?.message }}
        </div>
      </div>

      <div>
        <BaseButton :icon="IconPlus" outline @click="addCase" class="w-full mt-6">
          <span>Add case</span>
        </BaseButton>
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
          <BaseButton
            @click="exportResults"
            :loading="isExporting"
            :disabled="!allTestsHaveResults"
            outline
            class="!h-8 !px-3 text-sm"
            >Share</BaseButton
          >
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

.text-shadow {
  --width: 2px;
  --width-negative: calc(var(--width) * -1);
  text-shadow: var(--width-negative) var(--width-negative) 0 #000, 0 var(--width-negative) 0 #000,
    var(--width) var(--width-negative) 0 #000, var(--width) 0 0 #000,
    var(--width) var(--width) 0 #000, 0 var(--width) 0 #000,
    var(--width-negative) var(--width) 0 #000, var(--width-negative) 0 0 #000;
}
</style>
