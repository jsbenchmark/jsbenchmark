<script setup lang="ts">
import { Dependency, LogEntry, ReplState, TestCase, TimeMarker } from '~/types'
import { COLORS } from '~/utils/constants'
import { useWebWorkerFn } from '~/utils/worker'
import chroma from 'chroma-js'

definePageMeta({
  layout: false,
})

const config = ref({
  name: '',
  parallel: true,
  test: {
    dependencies: [] as Dependency[],
    code: `LOG('Start', { foo: 'bar' })

TIME('First')
await new Promise((r) => setTimeout(r, 100))
TIME('First')

TIME('Second')
await new Promise((r) => setTimeout(r, 250))
TIME('Second')`,
  } as TestCase,
})

const isRunning = ref(false)

const run = async () => {
  isRunning.value = true
  await Promise.allSettled([runCase(config.value.test), new Promise((r) => setTimeout(r, 1000))])
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

  console.log('dependencies', dependencies)

  const { workerFn, workerTerminate } = useWebWorkerFn(
    async ({ code, dataCode, time, warmupTime }, d?: any) => {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

      // const dataFn = AsyncFunction(dataCode)
      // const data = await dataFn(d)
      // ;(globalThis as any).DATA = data

      const logs: LogEntry[] = []
      ;(globalThis as any).LOG = (...values: any[]) => {
        console.log(...values)
        const time = performance.now()

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
        const now = performance.now()

        const startMarker = markers.findLast((m) => m.name === name)
        if (startMarker && !startMarker.duration) {
          startMarker.duration = now - startMarker.time
        } else {
          markers.push({
            name,
            time: now,
          })
        }
        // postMessage({
        //   type: 'marker',
        //   name,
        //   time: performance.now(),
        // })
      }

      const fn = AsyncFunction(code)

      const start = performance.now()
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
    res = await workerFn({
      code: c.code,
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

const colorScale = chroma.scale(COLORS.GRADIENT).mode('lch').domain([0, 1])

const maxTimerDuration = computed(() => {
  return Math.max(...(state.value.result?.markers.map((m) => m.duration || 0) ?? [0]))
})
</script>

<template>
  <NuxtLayout name="default">
    <template #default>
      <div>
        <div class="flex-col lg:flex-row flex justify-between lg:items-start">
          <BaseInput
            v-model="config.name"
            placeholder="Name"
            blendin
            class="text-[2.3rem] font-bold flex-1 max-w-full"
            type="textarea"
          />

          <div class="mt-8 lg:ml-10 lg:mt-1.5 h-[50px] flex gap-3">
            <!-- <BaseButton
              @click="isShareSupported ? startShare() : clipboard.copy(getUrl())"
              :disabled="isAnyTestRunning"
              class="!px-0 aspect-square"
              outline
            >
              <IconLink v-if="!clipboard.copied.value" />
              <IconCheck v-else />
            </BaseButton> -->
            <BaseButton
              @click="run"
              :loading="isRunning"
              :disabled="isRunning"
              class="text-lg px-6 flex-1 lg:flex-auto"
              >Run</BaseButton
            >
          </div>
        </div>
        <div class="flex flex-col gap-3 mt-8">
          <!-- <h3 class="text-2xl font-bold">Setup</h3> -->
          <!-- <p class="text-gray-400 text-sm">
            This setup function should return the stuff you need in the tests. Anything returned
            will be available via the
            <code class="text-white">DATA</code>
            variable inside the test cases. Running the setup function is not part of the benchmark
            and it's run separately for each test case.
          </p> -->
          <Dependencies v-model:test="config.test" class="mt-2 mb-4" />
          <BaseCodeEditor v-model="config.test.code" />
        </div>

        <div class="mt-8">
          <h4 class="font-semibold text-2xl mb-5">Logs</h4>
          <div v-for="(log, i) in state.result?.logs ?? []" :key="i" class="font-mono mb-2">
            <div
              v-if="log.time !== state.result?.logs[i - 1]?.time"
              class="text-sm text-gray-400 mb-1"
            >
              {{ log.time.toFixed(3) }}
            </div>
            <pre>{{ log.value }}</pre>
          </div>
        </div>
      </div>
    </template>
    <template #sidebar>
      <div>
        <div v-for="(marker, i) in state.result?.markers ?? []" :key="i" class="font-mono mb-6">
          <div class="text-sm text-gray-400 flex items-center mb-1">
            <div>{{ marker.time.toFixed(3) }}</div>
            <div v-if="i !== 0" class="ml-4 text-gray-200">
              +{{ (marker.time - (state.result?.markers[i - 1]?.time || 0)).toFixed(3) }} ms
            </div>
          </div>
          <p>
            <span>{{ marker.name }}</span>
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
    </template>
  </NuxtLayout>
</template>
