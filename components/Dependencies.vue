<script setup lang="ts">
import { PropType } from 'vue'
import { IconPlus } from '@tabler/icons-vue'
import { TestCase, Dependency } from '~/types'
import { IconTrash } from '@tabler/icons-vue'
import { debounce, camelCase } from 'lodash-es'

const props = defineProps({
  test: {
    type: Object as PropType<TestCase>,
    default: () => ({}),
  },
  global: Boolean,
  nameIndexOffset: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits<{
  (event: 'update:test', value: TestCase): void
}>()

const model = useVModel(props, 'test', emit)

const addDep = () => {
  ;(model.value.dependencies ||= []).push({
    url: '',
    name: '',
  })
}

type DependencySearchEntry = {
  name: string
  version: string
}

const searchResults = ref<DependencySearchEntry[]>([])
const isSearching = ref(false)
const searchPackage = debounce(async (value: string) => {
  const res = await $fetch<{ results: DependencySearchEntry[] }>('/api/search-package', {
    query: {
      q: value,
    },
  })
  isSearching.value = false

  searchResults.value = res.results.slice(0, 10)
}, 500)

const handleUrlUpdate = (value: string, dep: Dependency) => {
  searchResults.value = []
  value = value.trim()

  if (!value) {
    return
  }

  if (value.startsWith('http')) {
    if (value?.endsWith('+esm')) {
      dep.esm = true
    }

    if (value) {
      // Get name between last / and @
      const name = value.match(/\/([^\/]+)@/)?.[1] || ''
      dep.name = camelCase(name)
    }
    return
  }

  isSearching.value = true
  searchPackage(value)
}
</script>

<template>
  <div>
    <div class="flex-col lg:flex-row flex justify-between lg:items-center">
      <div class="flex">
        <div class="flex">
          <h5 class="font-semibold text-base">{{ global ? 'Global ' : '' }}Dependencies</h5>
        </div>

        <div class="ml-4">
          <button
            @click="addDep"
            class="text-[0.8rem] uppercase font-medium tracking-wider flex items-center bg-gray-800 rounded px-2 py-0.5 hover:bg-gray-700 transition"
          >
            <IconPlus class="mr-1 -ml-1" :size="16" :stroke-width="2.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      <div class="mt-2 lg:mt-0">
        <p class="text-xs text-gray-500 transition cursor-help">
          You can use sites like
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

    <div
      v-for="(dep, i) in test.dependencies"
      class="flex-col lg:flex-row flex items-start gap-3 mt-3"
    >
      <BaseAutocomplete
        v-model="dep.url"
        :options="searchResults"
        placeholder="Type to search or paste direct URL"
        @update:model-value="(v) => handleUrlUpdate(v, dep)"
        value-field="url"
        :show-options="!dep.url.startsWith('http')"
        :error="dep.url && !dep.url.startsWith('http') ? 'Invalid URL' : undefined"
      >
        <template #option="{ option }">
          <div class="flex items-center flex-nowrap">
            <span class="truncate flex-1 mr-2 font-medium">
              {{ option.name }}
            </span>
            <span class="text-gray-500 font-mono text-sm ml-auto">
              {{ option.version }}
            </span>
          </div>
        </template>

        <template #empty>
          <div v-if="isSearching">Searching...</div>
          <div v-else>No packages found.</div>
        </template>
      </BaseAutocomplete>
      <BaseInput
        v-model="dep.name"
        v-if="dep.esm"
        :placeholder="`Import as: DEP_${nameIndexOffset + i}`"
        class="lg:!w-52 shrink-0 font-mono"
      />

      <label
        class="flex items-center rounded-md border border-gray-700 px-4 cursor-pointer justify-center h-11"
      >
        <input type="checkbox" v-model="dep.esm" />
        <span class="ml-2 py-2 lg:py-0">ESM</span>
      </label>

      <BaseButton
        @click="test.dependencies?.splice(i, 1)"
        class="!bg-transparent border border-gray-700 px-0 aspect-square text-gray-400"
      >
        <IconTrash :size="20" />
      </BaseButton>
    </div>
  </div>
</template>
