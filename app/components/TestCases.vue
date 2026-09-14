<script lang="ts" setup>
import type { Config, TestCase, TestState } from '~/types'
import { useSortable } from '@vueuse/integrations/useSortable'

const $props = defineProps<{
  modelValue: TestCase[]
  stateByTest: Record<string, TestState>
  config: Config
}>()

const emit = defineEmits<{
  (event: 'run', payload: TestCase): void
  (event: 'remove', payload: TestCase): void
  (event: 'duplicate', payload: TestCase): void
}>()

const testCases = defineModel<TestCase[]>({ required: true })

const listRef = ref<HTMLElement>()

useSortable(listRef, testCases, {
  handle: '[data-handle]',
  animation: 200,
})

const ASYNC_KEYWORDS = ['async', 'await', 'Promise', '.then', '.catch', 'reject', 'resolve']

// Detect async keywords in code and mark test case as async.
watchDebounced(
  () => testCases.value,
  (cases) => {
    for (const test of cases) {
      // Only enable async flag if it wasn't set already or disabled manually.
      if (test.async !== undefined) continue

      if (ASYNC_KEYWORDS.some((keyword) => test.code.includes(keyword))) {
        testCases.value.find((t) => t.id === test.id)!.async = true
      }
    }
  },
  { debounce: 500, deep: true }
)

const optionsOpenOnTestCase = ref<TestCase | null>(null)

const optionItems = [
  [
    {
      label: 'Duplicate',
      icon: 'i-tabler-copy',
      onSelect: () => {
        emit('duplicate', optionsOpenOnTestCase.value!)
      },
    },
    {
      label: 'Delete',
      icon: 'i-tabler-trash',
      onSelect: () => {
        emit('remove', optionsOpenOnTestCase.value!)
      },
    },
  ],
]

const onOptionsOpen = (open: boolean, c: TestCase) => {
  if (open) {
    optionsOpenOnTestCase.value = c
  }
}

const formatOpsPerSecond = (value: number | undefined) =>
  value?.toLocaleString(undefined, { maximumSignificantDigits: 4 }) || '?'
</script>

<template>
  <div>
    <TransitionGroup name="list" tag="div" ref="listRef" class="relative">
      <div
        v-for="(c, index) of testCases"
        :key="c.id"
        class="border rounded-xl border-gray-800 p-6 flex flex-col gap-4 bg-gray-900 relative mb-8"
      >
        <div class="flex-col lg:flex-row flex lg:items-center justify-between">
          <div class="flex items-stretch gap-2 -ml-1">
            <div
              data-handle
              class="flex items-center text-gray-600 hover:text-white transition text-xl select-none cursor-grab"
            >
              <UIcon name="i-tabler-grip-vertical" />
            </div>
            <UInput
              :ui="{ base: 'p-0' }"
              variant="none"
              v-model="c.name"
              placeholder="Name"
              class="font-semibold flex-1 mr-8"
              size="xl"
            />
          </div>
          <div class="flex lg:justify-end items-center space-x-4 h-10">
            <div
              class="rounded-md h-full px-0 lg:mr-6 -border -bg-gray-800 flex items-center mr-auto"
            >
              <div class="flex items-center font-mono space-x-2 text-sm">
                <div class="text-gray-400">Ops/s:</div>
                <div>
                  {{ formatOpsPerSecond(stateByTest[c.id]?.result?.opsPerSecond) }}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UTooltip text="Function is async and should be awaited." :content="{ side: 'top' }">
                <BaseCheckboxButton v-model="c.async" label="Async" class="h-8" />
              </UTooltip>

              <UButton
                @click="emit('run', c)"
                :loading="stateByTest[c.id]?.status === 'running'"
                variant="outline"
                color="primary"
                size="md"
                >Run</UButton
              >

              <UDropdownMenu
                :items="optionItems"
                :content="{ side: 'bottom', align: 'end' }"
                @update:open="(v) => onOptionsOpen(v, c)"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  trailing-icon="i-heroicons-chevron-down-20-solid"
                />
              </UDropdownMenu>
            </div>
          </div>
        </div>
        <BaseCodeEditor v-model="c.code" @run="emit('run', c)" />

        <DependencyList
          :test="testCases[index]!"
          :name-index-offset="config.globalTestConfig.dependencies?.length || 0"
          @update:test="testCases[index] = $event"
        />

        <UAlert
          v-if="stateByTest[c.id]?.status === 'error'"
          icon="i-tabler-alert-circle"
          color="error"
          variant="subtle"
          title="Error"
          :description="stateByTest[c.id]?.error?.message"
        />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.list-leave-active {
  position: absolute;
  width: 100%;
  z-index: -1;
}
</style>
