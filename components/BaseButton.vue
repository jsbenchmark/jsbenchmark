<script setup lang="ts">
import { IconLoader } from '@tabler/icons-vue';

defineProps({
  tag: {
    type: String,
    default: "button",
  },
  disabled: Boolean,
  loading: Boolean,
  icon: {
    type: null,
  }
});
</script>

<template>
  <Component
    :is="tag"
    class="px-5 h-11 rounded-md bg-white text-black font-semibold flex items-center justify-center"
    :class="{
      'opacity-50 cursor-not-allowed': disabled || loading,
    }"
  >
    <IconLoader v-if="loading" class="animate-spin mr-2 -ml-1" />
    <span>
      <slot />
    </span>
  </Component>
</template>
