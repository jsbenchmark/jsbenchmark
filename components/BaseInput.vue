<script setup lang="ts">
const $props = defineProps<{
  modelValue?: string;
  blendin?: boolean;
  type?: string;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

const inputRef = ref<HTMLInputElement | HTMLTextAreaElement>();
const value = computed(() => $props.modelValue);

useTextareaAutosize({
  element: inputRef as Ref<HTMLTextAreaElement>,
  input: value,
});
</script>

<template>
  <input
    v-if="type !== 'textarea'"
    :value="modelValue"
    @input="e => emit('update:modelValue', (e.target as HTMLInputElement).value)"
    class="max-w-none min-w-0 outline-none"
    :class="{
      'bg-black rounded-md border border-gray-700 px-4 h-11 w-full': !blendin,
      'bg-transparent': blendin,
    }"
  />
  <textarea
    v-else
    :value="modelValue"
    @input="e => emit('update:modelValue', (e.target as HTMLTextAreaElement).value)"
    class="max-w-none min-w-0 outline-none resize-none"
    :class="{
      'bg-black rounded-md border border-gray-700 px-4 h-11 w-full': !blendin,
      'bg-transparent': blendin,
    }"
    ref="inputRef"
  ></textarea>
</template>
