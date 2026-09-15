<script setup lang="ts">
import type { TestCase } from '~/types'
import type { Dependency as DependencyComponent } from '#components'

const props = defineProps<{
  test: TestCase
  global?: boolean
  nameIndexOffset?: number
  showHint?: boolean
}>()

const model = defineModel<TestCase>('test', { required: true })

const dependencyRefs = ref<InstanceType<typeof DependencyComponent>[]>([])

const addDep = () => {
  ;(model.value.dependencies ||= []).push({
    url: '',
    name: '',
    esm: false,
  })

  nextTick(() => {
    dependencyRefs.value[dependencyRefs.value.length - 1]?.focus()
  })
}
</script>

<template>
  <div>
    <div class="flex-col lg:flex-row flex justify-between lg:items-center">
      <div class="flex items-center gap-3">
        <h5 class="font-semibold text-base">{{ global ? 'Global ' : '' }}Dependencies</h5>

        <UButton
          @click="addDep"
          icon="i-tabler-plus"
          size="xs"
          color="neutral"
          variant="outline"
          class="relative top-px"
        >
          Add
        </UButton>
      </div>

      <div v-if="showHint" class="mt-2 lg:mt-0">
        <p class="text-xs text-muted transition cursor-help">
          You can also use sites like
          <a
            href="https://www.jsdelivr.com/"
            target="_blank"
            class="text-muted transition hover:text-highlighted"
            >jsDelivr</a
          >
          or
          <a
            href="https://www.skypack.dev/"
            target="_blank"
            class="text-muted transition hover:text-highlighted"
            >Skypack</a
          >
          to find URLs for packages.
        </p>
      </div>
    </div>

    <div v-if="!!$slots.help" class="text-muted mt-1.5 text-sm">
      <slot name="help" />
    </div>

    <Dependency
      v-for="(_, i) in model.dependencies"
      :key="i"
      :model-value="model.dependencies[i]!"
      :index="i"
      :name-index-offset="nameIndexOffset || 0"
      @update:model-value="model.dependencies![i] = $event"
      @remove="model.dependencies?.splice(i, 1)"
      ref="dependencyRefs"
    />
  </div>
</template>
