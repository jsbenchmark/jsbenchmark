<template>
  <div
    class="bg-elevated/50 flex items-center pl-2 pr-3 rounded-md border border-accented"
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
