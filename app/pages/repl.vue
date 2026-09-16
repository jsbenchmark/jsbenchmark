<script setup lang="ts">
import { DEFAULT_TEST_NAME } from '~/utils/constants'
import {
  createDefaultReplConfig,
  createEmptyReplConfig,
  normalizeReplConfig,
} from '~/utils/repl/config'
import { formatReplMarkdown } from '~/utils/repl/export'
import type { ReplConfig } from '~/utils/repl/types'

const config = ref<ReplConfig>(createDefaultReplConfig())
const previewHost = ref<HTMLElement>()
const editorTab = ref<'javascript' | 'html'>('javascript')
const colorMode = useColorMode()
const previewColorMode = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'))
const { hasDomPreview, isRunning, reset, run, state } = useReplExecution(
  config,
  previewHost,
  previewColorMode
)

const runtimeTabs = computed(() => [
  { label: 'Worker', value: 'worker', disabled: isRunning.value },
  { label: 'DOM', value: 'dom', disabled: isRunning.value },
])
const editorTabs = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'HTML fixture', value: 'html' },
]
const isHtmlEditorActive = computed(
  () => config.value.runtime === 'dom' && editorTab.value === 'html'
)

const clear = () => {
  config.value = createEmptyReplConfig()
  editorTab.value = 'javascript'
  reset()
}

useHead({
  title: computed(() => config.value.name),
  titleTemplate: (sub) => {
    return sub && sub !== DEFAULT_TEST_NAME ? `${sub} - JS Benchmark Repl` : 'JS Benchmark Repl'
  },
})

const route = useRoute()
const router = useRouter()

onMounted(() => {
  try {
    const urlState = deserialize(route.hash.slice(1))
    if (urlState?.config) config.value = normalizeReplConfig(urlState.config)
  } catch {
    // Keep the default example when a malformed hash cannot be decoded.
  }
})

watch(
  config,
  (value) => {
    router.replace({
      hash: `#${serialize({ config: value })}`,
    })
  },
  { deep: true }
)

watch(
  () => config.value.runtime,
  (runtime) => {
    if (runtime === 'worker') editorTab.value = 'javascript'
  }
)

const reportClipboard = useClipboard({ legacy: true })
const toast = useToast()
const copyMarkdown = async () => {
  if (state.value.status !== 'success' && state.value.status !== 'error') return
  await reportClipboard.copy(formatReplMarkdown(state.value, getUrl()))
  toast.add({
    title: 'Copied as Markdown',
    description: 'The latest REPL investigation is ready to paste.',
    color: 'success',
    icon: 'i-tabler-check',
  })
}
</script>

<template>
  <div>
    <SplitLayout>
      <template #default>
        <div class="flex min-w-0 flex-col gap-8">
          <div class="flex flex-col justify-between lg:flex-row lg:items-start">
            <UTextarea
              v-model="config.name"
              placeholder="Name"
              class="max-w-full flex-1 font-bold"
              autoresize
              :ui="{ base: 'p-0' }"
              variant="none"
              size="4xl"
              :rows="1"
            />

            <div class="mt-8 flex flex-col items-start gap-2 lg:ml-10 lg:mt-1.5 lg:items-end">
              <div class="flex flex-wrap items-center gap-3">
                <UTooltip text="Clear">
                  <UButton
                    @click="clear"
                    :disabled="isRunning"
                    aria-label="Clear REPL"
                    color="neutral"
                    variant="outline"
                    icon="i-tabler-trash"
                    size="lg"
                  />
                </UTooltip>
                <ShareButton :payload="{ config }" type="repl" />

                <div class="relative">
                  <UTabs
                    v-model="config.runtime"
                    :items="runtimeTabs"
                    :content="false"
                    :ui="{ trigger: 'last:pe-8' }"
                    aria-label="REPL environment"
                    variant="outline"
                    size="md"
                  />
                  <UPopover
                    :content="{ side: 'bottom', align: 'end', sideOffset: 16 }"
                    mode="hover"
                  >
                    <button
                      type="button"
                      aria-label="About DOM mode"
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
                      <div
                        class="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4 text-sm leading-relaxed"
                      >
                        <p class="font-semibold text-highlighted">DOM mode</p>
                        <p>
                          Runs once in a fresh sandboxed preview below the editor, with access to
                          browser APIs such as <code class="text-toned">document</code> and layout.
                        </p>
                        <p class="text-muted">
                          Synchronous infinite loops can make this page unresponsive. Worker mode
                          provides stronger isolation for code that does not need the DOM.
                        </p>
                      </div>
                    </template>
                  </UPopover>
                </div>

                <UButton
                  @click="run"
                  :loading="isRunning"
                  :disabled="isRunning"
                  size="lg"
                  class="font-semibold"
                  icon="i-tabler-play"
                >
                  Run
                </UButton>
              </div>
            </div>
          </div>

          <DependencyList v-model:test="config.test" />

          <section class="flex min-w-0 flex-col gap-3" aria-labelledby="repl-code-heading">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 id="repl-code-heading" class="text-2xl font-bold">Code</h2>
              <UTabs
                v-model="editorTab"
                :items="editorTabs"
                :content="false"
                :class="{
                  'invisible pointer-events-none': config.runtime !== 'dom',
                }"
                :aria-hidden="config.runtime !== 'dom'"
                :inert="config.runtime !== 'dom'"
                aria-label="REPL editor"
                variant="outline"
                size="sm"
              />
            </div>

            <div class="grid text-sm text-muted">
              <p
                class="flex flex-wrap items-center gap-x-1.5 gap-y-1 [grid-area:1/1]"
                :class="{ 'invisible pointer-events-none': isHtmlEditorActive }"
                :aria-hidden="isHtmlEditorActive"
              >
                <span>Return a value to show it in Output. Press</span>
                <span
                  class="inline-flex items-center gap-1"
                  aria-label="Control or Command plus Enter"
                >
                  <UKbd value="meta" size="sm" />
                  <span aria-hidden="true">+</span>
                  <UKbd value="enter" size="sm" />
                </span>
                <span>to run.</span>
              </p>
              <p
                class="[grid-area:1/1]"
                :class="{ 'invisible pointer-events-none': !isHtmlEditorActive }"
                :aria-hidden="!isHtmlEditorActive"
              >
                Optional body markup installed before dependencies and JavaScript execute.
              </p>
            </div>

            <div class="grid min-w-0">
              <div
                class="min-w-0 [grid-area:1/1]"
                :class="{ 'invisible pointer-events-none': isHtmlEditorActive }"
                :aria-hidden="isHtmlEditorActive"
                :inert="isHtmlEditorActive"
              >
                <BaseCodeEditor v-model="config.test.code" language="javascript" @run="run" />
              </div>
              <div
                class="min-w-0 [grid-area:1/1]"
                :class="{ 'invisible pointer-events-none': !isHtmlEditorActive }"
                :aria-hidden="!isHtmlEditorActive"
                :inert="!isHtmlEditorActive"
              >
                <BaseCodeEditor v-model="config.setupHtml" language="html" @run="run" />
              </div>
            </div>
          </section>

          <section
            v-if="config.runtime === 'dom'"
            class="flex flex-col gap-3"
            aria-labelledby="repl-preview-heading"
          >
            <div>
              <h2 id="repl-preview-heading" class="text-2xl font-bold">Preview</h2>
              <p class="mt-1 text-sm text-muted">Recreated from the HTML fixture on every run.</p>
            </div>
            <div
              class="relative h-96 overflow-hidden rounded-md border border-accented bg-default"
              :aria-busy="isRunning"
            >
              <div ref="previewHost" class="h-full w-full" />
              <div
                v-if="!hasDomPreview"
                class="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-gray-500"
              >
                Run the code to render the DOM preview.
              </div>
            </div>
          </section>
        </div>
      </template>

      <template #sidebar>
        <ReplOutputPanel :state="state" @copy-markdown="copyMarkdown" />
      </template>
    </SplitLayout>
  </div>
</template>
