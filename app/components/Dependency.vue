<script lang="ts" setup>
import { camelCase } from 'lodash-es'
import type { Dependency } from '~/types'

defineProps<{
  modelValue: Dependency
  index: number
  nameIndexOffset: number
}>()

const dep = defineModel<Dependency>({ required: true })

const emit = defineEmits<{
  (event: 'update:dependency', value: Dependency): void
  (event: 'remove'): void
}>()

const urlInputRef = ref<{ inputRef: HTMLInputElement | null }>()

defineExpose({
  focus: () => {
    urlInputRef.value?.inputRef?.focus()
  },
})

watch(
  () => dep.value.url,
  (value) => {
    if (!value) return

    if (value.startsWith('http')) {
      if (value.endsWith('+esm')) {
        dep.value.esm = true
      }

      if (value && !dep.value.name) {
        // Get name between last / and @
        const name = value.match(/\/([^\/]+)@/)?.[1] || ''
        dep.value.name = camelCase(name)
      }
      return []
    }
  }
)

const isSearching = ref(false)

type DependencySearchEntry = {
  name: string
  version: string
  url: string
}

const searchTerm = ref('')
const searchResults = ref<DependencySearchEntry[]>([])

watchDebounced(
  searchTerm,
  async (value) => {
    value = value.trim()

    if (!value || value.startsWith('http')) {
      searchResults.value = []
      return
    }

    isSearching.value = true
    try {
      const res = await $fetch<{ results: DependencySearchEntry[] }>('/api/search-package', {
        query: {
          q: value,
        },
      })
      searchResults.value = res.results.slice(0, 10)
    } finally {
      isSearching.value = false
    }
  },
  { debounce: 250 }
)
</script>
<template>
  <div class="flex-row flex-wrap flex items-stretch gap-3 mt-3">
    <UFormField class="flex-1 min-w-[200px]">
      <UInputMenu
        v-model="dep.url"
        v-model:search-term="searchTerm"
        :items="searchResults"
        :loading="isSearching"
        placeholder="Type to search or paste direct URL"
        mode="autocomplete"
        label-key="name"
        value-key="url"
        ignore-filter
        trailing
        ref="urlInputRef"
      >
        <template #item="{ item }">
          <div class="flex items-center flex-nowrap w-full justify-between">
            <span class="truncate flex-1 mr-2 font-medium">
              {{ item.name }}
            </span>
            <span class="text-gray-500 font-mono text-sm ml-auto">
              {{ item.version }}
            </span>
          </div>
        </template>

        <template #empty>
          <div v-if="isSearching">Searching...</div>
          <div v-else>No packages found.</div>
        </template>
      </UInputMenu>
    </UFormField>

    <div v-if="dep.esm" class="sm:!w-52 shrink-0 grow md:grow-0 font-mono">
      <UInput v-model="dep.name" :placeholder="`Import as: DEP_${nameIndexOffset + index}`" />
    </div>

    <BaseCheckboxButton v-model="dep.esm" label="ESM" />

    <UButton @click="emit('remove')" icon="i-tabler-trash" color="neutral" />
  </div>
</template>
