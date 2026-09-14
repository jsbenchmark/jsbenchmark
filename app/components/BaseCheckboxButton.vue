<template>
  <div
    class="bg-gray-700/25 flex items-center pl-2 pr-3 rounded-md border border-gray-700"
    @click.self="model = !model"
  >
    <UCheckbox v-model="model" :label="label" :ui="{ wrapper: 'ms-2.5' }" />
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  label: string
}>()

const model = defineModel<boolean>({ default: false })
</script>
