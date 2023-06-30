<script setup lang="ts">
import { IconLoader } from "@tabler/icons-vue";

defineProps({
  tag: {
    type: String,
    default: "button",
  },
  disabled: Boolean,
  loading: Boolean,
  icon: {
    type: null,
  },
  outline: Boolean,
});
</script>

<template>
  <Component
    :is="tag"
    class="px-5 h-11 max-h-full rounded-md font-semibold flex items-center justify-center transition"
    :class="{
      'opacity-50 cursor-not-allowed pointer-events-none': disabled || loading,

      'bg-white text-black': !outline,
      'bg-transparent text-gray-200 hover:text-white border border-gray-600 hover:border-white':
        outline,
    }"
  >
    <IconLoader v-if="loading" class="animate-spin mr-1.5 -ml-2" :size="20" />
    <Component v-else-if="icon" :is="icon" class="mr-1.5 -ml-2" :size="20" />
    <span>
      <slot />
    </span>
  </Component>
</template>
