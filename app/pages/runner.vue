<script setup lang="ts">
import {
  createDomChannelName,
  parseDomSessionFragment,
  serializeBenchmarkError,
} from '~/utils/benchmark/dom/protocol'
import type { ParentToRunnerMessage, RunnerToParentMessage } from '~/utils/benchmark/dom/protocol'
import {
  createDomFrameJob,
  registerDomRunnerClosingHandlers,
  type DomFrameJob,
} from '~/utils/benchmark/dom/runner'

definePageMeta({ layout: false, scrollToTop: false })

const frameHost = ref<HTMLElement>()
const idleStatus = ref('Waiting for a benchmark…')
const activeCases = shallowReactive(new Map<string, { name: string; job: DomFrameJob }>())

const activeCaseNames = computed(() => [...activeCases.values()].map(({ name }) => name))
const status = computed(() => {
  const count = activeCaseNames.value.length
  if (count === 0) return idleStatus.value

  return count === 1 ? 'Running benchmark…' : `Running ${count} benchmarks…`
})

let disposeRunner = () => {}

onMounted(() => {
  const sessionId = parseDomSessionFragment(window.location.hash.slice(1))
  if (!sessionId) {
    idleStatus.value = 'This runner link is invalid. Start a new DOM run from the benchmark page.'
    return
  }

  history.replaceState(null, '', `${location.pathname}${location.search}`)

  let channel: BroadcastChannel | undefined = new BroadcastChannel(createDomChannelName(sessionId))
  const postToParent = (message: RunnerToParentMessage) => channel?.postMessage(message)
  const reportVisibility = () => postToParent({ type: 'visibility', hidden: document.hidden })
  const stopClosingHandlers = registerDomRunnerClosingHandlers(window, () =>
    postToParent({ type: 'closing' })
  )

  document.addEventListener('visibilitychange', reportVisibility)

  disposeRunner = () => {
    document.removeEventListener('visibilitychange', reportVisibility)
    stopClosingHandlers()

    for (const { job } of activeCases.values()) job.cancel()
    activeCases.clear()

    channel?.close()
    channel = undefined
  }

  const runCase = async (message: Extract<ParentToRunnerMessage, { type: 'run' }>) => {
    const { requestId, payload, responseTimeoutMs } = message
    if (activeCases.has(requestId)) return

    const job = createDomFrameJob(payload, responseTimeoutMs)
    activeCases.set(requestId, { name: payload.caseName || 'Untitled case', job })
    frameHost.value!.append(job.frame)
    reportVisibility()

    try {
      const result = await job.result
      postToParent({ type: 'result', requestId, result })
      idleStatus.value = 'Benchmark complete.'
    } catch (error) {
      postToParent({ type: 'error', requestId, error: serializeBenchmarkError(error) })
      idleStatus.value = 'Benchmark failed.'
    } finally {
      activeCases.delete(requestId)
    }
  }

  channel.onmessage = ({ data }: MessageEvent<ParentToRunnerMessage>) => {
    if (data?.type === 'close') {
      disposeRunner()
      window.close()
    } else if (data?.type === 'run') {
      void runCase(data)
    }
  }

  postToParent({ type: 'ready' })
  reportVisibility()
})

onBeforeUnmount(() => disposeRunner())
</script>

<template>
  <main class="relative h-dvh min-h-0 overflow-hidden bg-default text-highlighted">
    <div ref="frameHost" class="absolute inset-0 z-0 h-full min-h-0 w-full bg-white" />
    <header
      class="runner-status relative z-10 flex h-full min-h-0 w-full items-center justify-center overflow-auto bg-default px-6 py-8 text-center sm:px-10"
    >
      <div class="max-w-md">
        <div class="mb-8 inline-flex items-center gap-3" aria-label="JS Benchmark">
          <img src="/logo.svg" alt="" class="size-11" />
          <span
            class="text-lg font-semibold tracking-wider text-salmon-700 uppercase dark:text-salmon-400"
          >
            jsbenchmark
          </span>
        </div>
        <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">DOM benchmark runner</h1>
        <p
          v-if="activeCaseNames.length"
          class="mt-4 text-base font-medium break-words text-toned sm:text-lg"
        >
          {{ activeCaseNames.join(' · ') }}
        </p>
        <p class="mt-2 text-base text-muted sm:text-lg" role="status" aria-live="polite">
          {{ status }}
        </p>
        <p class="mt-5 text-sm leading-relaxed text-muted sm:text-base">
          Keep this runner open while the benchmark is active. You can continue using the benchmark
          page.
        </p>
      </div>
    </header>
  </main>
</template>

<style scoped>
.runner-status {
  width: 100%;
  height: 100%;
}
</style>
