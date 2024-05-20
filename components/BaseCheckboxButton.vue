<template>
  <div
    class="bg-gray-700/25 flex items-center pl-2 pr-3 rounded-md border border-gray-700"
    @click.self="model = !model"
  >
    <UCheckbox v-model="model" :label="label" :ui="{ inner: 'ms-2.5' }" />
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  modelValue: boolean
  label: string
}>()

const model = defineModel<Boolean>()
</script>
