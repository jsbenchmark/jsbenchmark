<script setup lang="ts">
import type { TestCase } from '~/types'

const props = defineProps<{
  test: TestCase
  global?: Boolean
  nameIndexOffset?: number
  showHint?: Boolean
}>()

const model = defineModel<TestCase>('test', { required: true })

const addDep = () => {
  ;(model.value.dependencies ||= []).push({
    url: '',
    name: '',
    esm: false,
  })
}
</script>

<template>
  <div>
    <div class="flex-col lg:flex-row flex justify-between lg:items-center">
      <div class="flex items-center gap-3">
        <h5 class="font-semibold text-base">{{ global ? 'Global ' : '' }}Dependencies</h5>

        <UButton
          @click="addDep"
          icon="i-tabler-plus"
          size="2xs"
          color="white"
          class="relative top-px"
        >
          Add
        </UButton>
      </div>

      <div v-if="showHint" class="mt-2 lg:mt-0">
        <p class="text-xs text-gray-500 transition cursor-help">
          You can also use sites like
          <a
            href="https://www.jsdelivr.com/"
            target="_blank"
            class="text-gray-400 transition hover:text-white"
            >jsDelivr</a
          >
          or
          <a
            href="https://www.skypack.dev/"
            target="_blank"
            class="text-gray-400 transition hover:text-white"
            >Skypack</a
          >
          to find URLs for packages.
        </p>
      </div>
    </div>

    <div v-if="!!$slots.help" class="text-gray-400 mt-1.5 text-sm">
      <slot name="help" />
    </div>

    <Dependency
      v-for="(_, i) in model.dependencies"
      :key="i"
      v-model="model.dependencies[i]"
      :index="i"
      :name-index-offset="nameIndexOffset || 0"
      @remove="model.dependencies?.splice(i, 1)"
    />
  </div>
</template>
