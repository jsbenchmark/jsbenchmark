<script setup lang="ts">
import { PropType } from "vue";
import { IconPlus } from "@tabler/icons-vue";
import { Case } from "types";
import { IconTrash } from "@tabler/icons-vue";

const props = defineProps({
  test: {
    type: Object as PropType<Case>,
    default: () => ({}),
  },
  global: Boolean,
  nameIndexOffset: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits<{
  (event: "update:test", value: Case): void;
}>();

const model = useVModel(props, "test", emit);

const addDep = () => {
  (model.value.dependencies ||= []).push({
    url: "",
    name: "",
  });
};
</script>

<template>
  <div>
    <div class="flex-col lg:flex-row flex justify-between lg:items-center">
      <div class="flex">
        <div class="flex">
          <h5 class="font-semibold text-base">
            {{ global ? "Global " : "" }}Dependencies
          </h5>
        </div>

        <div class="ml-4">
          <button
            @click="addDep"
            class="text-[0.8rem] uppercase font-medium tracking-wider flex items-center bg-gray-800 rounded px-2 py-0.5 hover:bg-gray-700 transition"
          >
            <IconPlus class="mr-1 -ml-1" :size="16" :stroke-width="2.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      <div class="mt-2 lg:mt-0">
        <p
          class="text-xs text-gray-500 transition hover:text-gray-300 cursor-help"
        >
          Use sites like
          <a
            href="https://www.jsdelivr.com/"
            target="_blank"
            class="text-gray-400 transition hover:text-white"
            >jsDelivr</a
          >
          or
          <a
            href="https://www.skypack.dev/"
            target="_blank"
            class="text-gray-400 transition hover:text-white"
            >Skypack</a
          >
          to find URLs for packages.
        </p>
      </div>
    </div>

    <div v-if="!!$slots.help" class="text-gray-400 mt-1.5 text-sm">
      <slot name="help" />
    </div>

    <div
      v-for="(dep, i) in test.dependencies"
      class="flex-col lg:flex-row flex gap-3 mt-3"
    >
      <BaseInput
        v-model="dep.url"
        placeholder="URL, e.g. https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/+esm"
      />
      <BaseInput
        v-model="dep.name"
        v-if="dep.esm"
        :placeholder="`Import as: DEP_${nameIndexOffset + i}`"
        class="lg:!w-52 shrink-0 font-mono"
      />

      <label
        class="flex items-center rounded-md border border-gray-700 px-4 cursor-pointer justify-center"
      >
        <input type="checkbox" v-model="dep.esm" />
        <span class="ml-2 py-2 lg:py-0">ESM</span>
      </label>

      <BaseButton
        @click="test.dependencies?.splice(i, 1)"
        class="!bg-transparent border border-gray-700 px-0 aspect-square text-gray-400"
      >
        <IconTrash :size="20" />
      </BaseButton>
    </div>
  </div>
</template>
