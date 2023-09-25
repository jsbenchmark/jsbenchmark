<script setup lang="ts">
import { Dependency, LogEntry, ReplState, TestCase, TestState, TimeMarker } from '~/types'
import { useWebWorkerFn } from '~/utils/worker'

definePageMeta({
  layout: false,
})

const config = ref({
  name: '',
  parallel: true,
  test: {
    dependencies: [] as Dependency[],
    code: `LOG('Start', { foo: 'bar' })
TIME('Start')
await new Promise((r) => setTimeout(r, 1000))
TIME('End')`,
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
        markers.push({
          name,
          time: performance.now(),
        })
        // postMessage({
        //   type: 'marker',
        //   name,
        //   time: performance.now(),
        // })
      }

      // Warmup.
      // let warmupTimes = 0
      // const warmupStart = performance.now()

      // while (performance.now() - warmupStart < warmupTime) {
      //   await fn()
      //   warmupTimes++
      // }

      // Actual test.
      // let times = 0
      // const start = performance.now()

      // while (performance.now() - start < time) {
      //   await fn()
      //   times++
      // }
      const fn = AsyncFunction(code)

      const start = performance.now()
      await fn()
      const end = performance.now()

      return {
        markers,
        logs,
      }
    },
    {
      timeout: TEST_TIMEOUT,
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

    state.value = {
      status: 'success',
      error: null,
      result: {
        markers: res.markers,
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

        <div class="mt-5">
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
          <p>{{ marker.name }}</p>
        </div>
      </div>
    </template>
  </NuxtLayout>
</template>
