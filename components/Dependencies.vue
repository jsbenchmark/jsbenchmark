<script setup lang="ts">
import { PropType } from "vue";
import { IconPlus } from "@tabler/icons-vue";
import { Case } from "types";

const props = defineProps({
  test: {
    type: Object as PropType<Case>,
    default: () => ({}),
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
    <div class="flex justify-start items-center">
      <div class="flex">
        <label>Dependencies</label>
      </div>

      <div>
        <button
          @click="addDep"
          class="text-sm uppercase font-medium tracking-wide flex items-center"
        >
          <IconPlus class="mr-1" :size="16" />
          <span>Add</span>
        </button>
      </div>
    </div>
    <div v-for="(dep, i) in test.dependencies" class="flex gap-3">
      <BaseInput v-model="dep.url" placeholder="URL" />
      <BaseInput
        v-model="dep.name"
        v-if="dep.esm"
        :placeholder="`Name: DEP_${i}`"
        class="w-1/3"
      />

      <label
        class="flex items-center rounded-md border border-gray-700 px-4 cursor-pointer"
      >
        <input type="checkbox" v-model="dep.esm" />
        <span class="ml-2">ESM</span>
      </label>
    </div>
  </div>
</template>
