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
    <div class="flex justify-start items-center">
      <div class="flex">
        <h5 class="font-medium">{{ global ? "Global " : "" }}Dependencies</h5>
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
    <div v-for="(dep, i) in test.dependencies" class="flex gap-3 mt-2">
      <BaseInput v-model="dep.url" placeholder="URL" />
      <BaseInput
        v-model="dep.name"
        v-if="dep.esm"
        :placeholder="`Import as: DEP_${i}`"
        class="w-80"
      />

      <label
        class="flex items-center rounded-md border border-gray-700 px-4 cursor-pointer"
      >
        <input type="checkbox" v-model="dep.esm" />
        <span class="ml-2">ESM</span>
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
