<script setup lang="ts">
import type { Dependency, LogEntry, ReplState, TestCase, TimeMarker } from '~/types'
import { COLORS, DEFAULT_TEST_NAME } from '~/utils/constants'
import { useWebWorkerFn } from '~/utils/worker'
import chroma from 'chroma-js'

const config = ref({
  name: DEFAULT_TEST_NAME,
  test: {
    dependencies: [] as Dependency[],
    code: `LOG('Hello World!', { foo: 'bar' })

TIME('First')
await new Promise((r) => setTimeout(r, 100))
TIME('First')

TIME('Second')
await new Promise((r) => setTimeout(r, 250))
TIME('Second')

TIME('Done!')`,
  } as TestCase,
})

const clear = () => {
  config.value = {
    name: '',
    test: {
      dependencies: [] as Dependency[],
      code: '',
    } as TestCase,
  }
}

useHead({
  title: computed(() => config.value.name),
  titleTemplate: (sub) => {
    return sub && sub !== DEFAULT_TEST_NAME ? `${sub} - JS Benchmark Repl` : 'JS Benchmark Repl'
  },
})

const isRunning = ref(false)

const run = async () => {
  isRunning.value = true
  await runCase(config.value.test)
  isRunning.value = false
}

const state = ref<ReplState>({
  status: 'idle',
  error: null,
  result: {
    markers: [],
    logs: [],
  },
})

const runCase = async (c: TestCase) => {
  state.value = {
    status: 'running',
    error: null,
  }

  const dependencies = config.value.test.dependencies?.filter((d) => d.url) ?? []

  const { workerFn, workerTerminate } = useWebWorkerFn(
    async ({ code, dataCode, time, warmupTime }, d?: any) => {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

      let start = 0

      const logs: LogEntry[] = []
      ;(globalThis as any).LOG = (...values: any[]) => {
        const time = performance.now() - start

        logs.push(
          ...values.map((v) => {
            let value: string = v
            if (typeof v === 'function') {
              value = v.toString()
            } else {
              value = JSON.stringify(v)
            }

            return {
              value,
              time,
            }
          })
        )
      }

      const markers: TimeMarker[] = []
      ;(globalThis as any).TIME = (name: string) => {
        const now = performance.now() - start

        const startMarker = markers.findLast((m) => m.name === name)
        if (startMarker && !startMarker.duration) {
          startMarker.duration = now - startMarker.time
        } else {
          markers.push({
            name,
            time: now,
          })
        }
        // TODO: Realtime markers/logs?
        // postMessage({
        //   type: 'marker',
        //   name,
        //   time: performance.now(),
        // })
      }

      const fn = AsyncFunction(code)

      start = performance.now()
      await fn()
      const end = performance.now()

      return {
        start,
        end,
        markers,
        logs,
      }
    },
    {
      timeout: 30_000,
      dependencies: dependencies,
      esm: dependencies.some((d) => d.esm),
    }
  )

  let res
  try {
    const code = compile({
      code: c.code,
    })

    res = await workerFn({
      code,
      time: TEST_TIME,
      warmupTime: WARMUP_TIME,
    })

    const totalDuration = res.end - res.start

    state.value = {
      status: 'success',
      error: null,
      result: {
        duration: totalDuration,
        markers: res.markers.map((m) => {
          return {
            name: m.name,
            time: m.time,
            duration: m.duration,
            durationPercentage: m.duration ? m.duration / totalDuration : undefined,
          }
        }),
        logs: res.logs.map((l) => {
          let value = l.value

          try {
            value = JSON.parse(value)
          } catch (error) {}

          return {
            time: l.time,
            value,
          }
        }),
      },
    }
  } catch (e) {
    console.error(e)

    const error = ((e as Error).message ? e : new Error('Unknown error')) as Error
    console.error(`Worker failed with error: `, error)
    state.value = {
      status: 'error',
      error: error,
      result: undefined,
    }
    workerTerminate()
  }
}

const route = useRoute()
const router = useRouter()

// Read state from URL.
onMounted(() => {
  const urlState = deserialize(route.hash.slice(1))
  if (urlState) {
    config.value = urlState.config
  }
})

// Write state to URL.
watch(
  config,
  (v) => {
    const encoded = serialize({
      config: v,
    })

    router.replace({
      hash: `#${encoded}`,
    })
  },
  { deep: true }
)

const colorScale = chroma.scale(COLORS.GRADIENT).mode('lch').domain([0, 1])

const maxTimerDuration = computed(() => {
  return Math.max(...(state.value.result?.markers.map((m) => m.duration || 0) ?? [0]))
})
</script>

<template>
  <div>
    <SplitLayout>
      <template #default>
        <div>
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
              <ShareButton :payload="{ config }" type="repl" />
              <UButton
                @click="run"
                :loading="isRunning"
                :disabled="isRunning"
                size="lg"
                class="font-semibold"
                icon="i-tabler-play"
                >Run</UButton
              >
            </div>
          </div>
          <div class="flex flex-col gap-3 mt-8">
            <DependencyList v-model:test="config.test" class="mt-2 mb-4" />
            <BaseCodeEditor v-model="config.test.code" @run="run" />

            <div
              v-if="state.status === 'error'"
              class="bg-red-600/10 text-red-500 rounded-md px-4 py-3 font-mono border border-red-600"
            >
              {{ state.error?.message }}
            </div>
          </div>

          <div class="mt-8">
            <h4 class="font-semibold text-2xl mb-5">Logs</h4>

            <div v-show="isRunning" class="space-y-3">
              <USkeleton class="h-6 w-32" />
              <USkeleton class="h-6 w-80" />
              <USkeleton class="h-6 w-64" />
            </div>
            <div
              v-show="!isRunning && !state?.result?.logs?.length"
              class="text-gray-400 space-y-3"
            >
              <p>
                Nothing logged yet. Add
                <code class="px-1.5 py-0.5 bg-gray-700 text-sm text-white rounded"
                  >LOG('foo', { bar: 'baz' }, ...)</code
                >
                to your code to log something. The logs will also be available in the browser
                devtools/console.
              </p>
              <p>
                The logged values need to be JSON serializable, because your code runs in a web
                worker. If something doesn't look right, try checking the console.
              </p>
            </div>

            <div v-show="!isRunning && state?.result?.logs?.length">
              <div v-for="(log, i) in state.result?.logs ?? []" :key="i" class="font-mono mb-2">
                <div
                  v-if="log.time !== state.result?.logs[i - 1]?.time"
                  class="text-sm text-gray-400 mb-1"
                  :class="{
                    'mt-6': i !== 0,
                  }"
                >
                  {{ log.time.toFixed(3) }} ms
                </div>
                <pre>{{ log.value }}</pre>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #sidebar>
        <div>
          <h2 class="text-3xl font-bold mb-10">Time markers</h2>

          <div v-if="isRunning" class="space-y-4">
            <USkeleton class="h-[2.75em] w-3/4" />
            <USkeleton class="h-[2.75em] w-full" />
            <USkeleton class="h-[2.75em] w-2/4" />
          </div>
          <div v-else-if="!state?.result?.markers?.length" class="text-gray-400 space-y-3">
            <p>
              No markers yet. Add
              <code class="px-1.5 py-0.5 bg-gray-700 text-sm text-white rounded">TIME('name')</code>
              to your code to add markers.
            </p>
            <p>
              When two markers have the same name, the duration between them will be calculated.
            </p>
          </div>

          <div v-else>
            <div v-for="(marker, i) in state.result?.markers ?? []" :key="i" class="font-mono mb-6">
              <div class="text-sm text-gray-400 flex items-center mb-1">
                <div>{{ marker.time.toFixed(3) }} ms</div>
                <div v-if="i !== 0" class="ml-2" title="Time difference to previous marker">
                  (+{{ (marker.time - (state.result?.markers[i - 1]?.time || 0)).toFixed(3) }} ms)
                </div>
              </div>
              <p>
                <span class="font-bold">{{ marker.name }}</span>
                <span v-if="marker.duration">: {{ marker.duration.toFixed(3) }} ms</span>
              </p>

              <div class="relative mt-2">
                <div
                  v-if="marker.duration"
                  class="rounded-[0.375em] h-[2.75em] transition-all duration-500 striped"
                  :style="{
                    backgroundColor: colorScale(marker.duration / maxTimerDuration).hex(),
                    width: (marker.duration / maxTimerDuration) * 100 + '%',
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </SplitLayout>
  </div>
</template>
