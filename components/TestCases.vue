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
}>()

const testCases = defineModel<TestCase[]>({ required: true })

const listRef = ref<HTMLElement>()

useSortable(listRef, testCases, {
  handle: '[data-handle]',
  animation: 200,
})
</script>

<template>
  <div>
    <TransitionGroup name="list" tag="div" ref="listRef" class="relative flex flex-col gap-8">
      <div
        v-for="(c, index) of testCases"
        :key="c.id"
        class="border rounded-xl border-gray-800 p-6 flex flex-col gap-4 bg-gray-900"
      >
        <div class="flex-col lg:flex-row flex lg:items-center justify-between">
          <div class="flex items-stretch gap-2 -ml-1">
            <div
              data-handle
              class="flex items-center text-gray-600 hover:text-white transition text-xl select-none"
            >
              <UIcon name="i-tabler-grip-vertical" class="cursor-grab" />
            </div>
            <UInput
              :padded="false"
              variant="none"
              v-model="c.name"
              placeholder="Name"
              class="font-semibold flex-1 mr-8"
              size="xl"
            />
          </div>
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
                @click="emit('run', c)"
                :loading="stateByTest[c.id]?.status === 'running'"
                variant="outline"
                color="primary"
                size="md"
                >Run</UButton
              >
              <UButton @click="emit('remove', c)" color="white" icon="i-tabler-trash" size="md" />
            </div>
          </div>
        </div>
        <BaseCodeEditor v-model="c.code" @run="emit('run', c)" />

        <DependencyList
          v-model:test="testCases[index]"
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
  </div>
</template>
