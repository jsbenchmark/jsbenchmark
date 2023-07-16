<script setup lang="ts">
import {
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
} from "@headlessui/vue";

defineProps<{
  modelValue?: string;
  options: any[];
  valueField: string;
  placeholder?: string;
  showOptions?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "input", value: string): void;
}>();

const handleChange = (value: string) => {
  emit("input", value);
  emit("update:modelValue", value);
};
</script>

<template>
  <Combobox
    as="div"
    class="flex-1"
    :model-value="modelValue"
    @update:modelValue="emit('update:modelValue', $event)"
    v-slot="{ open }"
  >
    <ComboboxInput
      @change="handleChange($event.target.value)"
      class="bg-black rounded-md border px-4 h-11 outline-none w-full border-gray-700"
      :class="{
        'ui-not-open:!border-red-500': !!error,
      }"
      :placeholder="placeholder"
    />

    <div
      v-show="open && (showOptions === undefined || showOptions)"
      class="relative z-10 w-full"
    >
      <ComboboxOptions
        static
        class="absolute top-1 left-0 bg-gray-800 border-gray-700 rounded-md border w-64 p-1.5 shadow-xl shadow-black/40"
      >
        <div v-if="!options.length" class="px-3 py-2 text-gray-400">
          <slot name="empty"> No results found. </slot>
        </div>
        <ComboboxOption
          v-for="option in options"
          :key="option"
          :value="option[valueField]"
          class="px-3 py-2 rounded hover:bg-white hover:text-black transition w-full ui-active:bg-white ui-active:text-black"
        >
          <slot name="option" :option="option">
            {{ option }}
          </slot>
        </ComboboxOption>
      </ComboboxOptions>
    </div>

    <div v-if="error" class="text-red-500 text-sm mt-1">
      {{ error }}
    </div>
  </Combobox>
</template>
