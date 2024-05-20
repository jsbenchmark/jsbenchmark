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

const urlInputRef = ref<ComponentPublicInstance>()

defineExpose({
  focus: () => {
    // TODO: Clean this up once Nuxt UI provides a better way to focus inputs.
    urlInputRef.value?.$el?.parentNode?.querySelector('input')?.focus()
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
}

const search = async (value: string, dep: Dependency) => {
  value = value.trim()

  if (!value) {
    return []
  }

  isSearching.value = true
  const res = await $fetch<{ results: DependencySearchEntry[] }>('/api/search-package', {
    query: {
      q: value,
    },
  })
  isSearching.value = false

  return res.results.slice(0, 10)
}
</script>
<template>
  <div class="flex-row flex-wrap flex items-stretch gap-3 mt-3">
    <UFormGroup class="flex-1 min-w-[200px]">
      <UInputMenu
        v-model="dep.url"
        v-model:query="dep.url"
        :search="(q: string) => search(q, dep)"
        :loading="isSearching"
        placeholder="Type to search or paste direct URL"
        option-attribute="name"
        value-attribute="url"
        trailing
        ref="urlInputRef"
      >
        <template #option="{ option }">
          <div class="flex items-center flex-nowrap w-full justify-between">
            <span class="truncate flex-1 mr-2 font-medium">
              {{ option.name }}
            </span>
            <span class="text-gray-500 font-mono text-sm ml-auto">
              {{ option.version }}
            </span>
          </div>
        </template>

        <template #option-empty>
          <div v-if="isSearching">Searching...</div>
          <div v-else>No packages found.</div>
        </template>
      </UInputMenu>
    </UFormGroup>

    <div v-if="dep.esm" class="sm:!w-52 shrink-0 grow md:grow-0 font-mono">
      <UInput v-model="dep.name" :placeholder="`Import as: DEP_${nameIndexOffset + index}`" />
    </div>

    <BaseCheckboxButton v-model="dep.esm" label="ESM" />

    <UButton @click="emit('remove')" icon="i-tabler-trash" color="white" />
  </div>
</template>
