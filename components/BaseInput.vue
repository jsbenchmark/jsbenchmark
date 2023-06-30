<script setup lang="ts">
defineProps<{
  modelValue?: string;
  blendin?: boolean;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();
</script>

<template>
  <input
    :value="modelValue"
    @input="e => emit('update:modelValue', (e.target as HTMLInputElement).value)"
    class="max-w-none min-w-0 outline-none"
    :class="{
      'bg-black rounded-md border border-gray-700 px-4 h-11 w-full': !blendin,
      'bg-transparent': blendin,
    }"
  />
</template>
