<script lang="ts" setup>
const $props = defineProps<{
  payload: any
  type: 'benchmark' | 'repl'
}>()

const runtimeConfig = useRuntimeConfig()

const shortcode = ref<string>('')
const generatingShortcode = ref(false)
const error = ref('')
const shortlink = computed(() => {
  if (!shortcode.value) return ''
  return `${runtimeConfig.public.workerUrl}/${shortcode.value}`
})

const route = useRoute()

const currentUrl = computed(() => {
  if (!import.meta.client) return ''
  return `${window.location.origin}${route.fullPath}`
})

const generateShortcode = async () => {
  generatingShortcode.value = true
  shortcodeGeneratedForPayloadString.value = payloadString.value

  try {
    const { code } = await $fetch('/api/publish', {
      method: 'POST',
      body: $props.payload,
      onResponseError: ({ response, error: e }) => {
        error.value = response?._data?.data?.message || (e as Error).message
      },
    })

    shortcode.value = code
    nextTick(() => {
      copyToClipoard('short')
    })
  } finally {
    generatingShortcode.value = false
  }
}

const urlClipboard = reactive(useClipboard())
const shortlinkClipboard = reactive(useClipboard())

const payloadString = ref('')
const shortcodeGeneratedForPayloadString = ref('')
watchDebounced(
  () => $props.payload,
  (payload) => {
    payloadString.value = JSON.stringify(payload)
  },
  { debounce: 500 }
)

const payloadHasShortcode = computed(() => {
  return shortcode.value && shortcodeGeneratedForPayloadString.value === payloadString.value
})

const copyToClipoard = (type: 'default' | 'short') => {
  useTrackEvent('copy-share-link', {
    props: {
      type,
    },
  })

  switch (type) {
    case 'default':
      urlClipboard.copy(currentUrl.value)
      break
    case 'short':
      shortlinkClipboard.copy(shortlink.value)
      break
  }
}
</script>

<template>
  <div>
    <UPopover :ui="{ shadow: 'shadow-xl shadow-black/25' }" :popper="{ placement: 'bottom-end' }">
      <UButton color="white" size="lg" icon="i-tabler-share">Share</UButton>

      <template #panel>
        <div class="p-4 space-y-4 w-[350px]">
          <div>
            <h5 class="font-semibold text-base mb-2">Link to share</h5>

            <div class="flex items-end gap-2">
              <UFormGroup class="w-full">
                <UInput
                  :model-value="currentUrl"
                  placeholder="https://jsbenchmark.com/?test=..."
                  readonly
                  icon="i-tabler-link"
                  size="md"
                />
              </UFormGroup>
              <UButton
                color="white"
                @click="copyToClipoard('default')"
                :icon="urlClipboard.copied ? 'i-tabler-check' : 'i-tabler-copy'"
                size="md"
              />
            </div>
          </div>
          <div>
            <h5 class="font-semibold text-base mb-2">Need a shorter link?</h5>
            <div class="flex items-end gap-2">
              <UFormGroup class="w-full">
                <UInput
                  v-if="payloadHasShortcode"
                  :model-value="shortlink"
                  placeholder="https://jsbenchmark.com/?test=..."
                  readonly
                  icon="i-tabler-link"
                  size="md"
                />
                <UButton
                  v-else
                  color="primary"
                  block
                  @click="generateShortcode"
                  :loading="generatingShortcode"
                  size="md"
                  variant="outline"
                  >Generate and copy</UButton
                >
              </UFormGroup>
              <UButton
                v-if="payloadHasShortcode"
                color="white"
                @click="copyToClipoard('short')"
                :icon="shortlinkClipboard.copied ? 'i-tabler-check' : 'i-tabler-copy'"
                size="md"
              />
            </div>
          </div>
          <UAlert
            v-if="error"
            color="red"
            title="Something went wrong"
            :description="error"
            variant="subtle"
          />
          <UAlert
            v-else
            icon="i-tabler-info-square-rounded-filled"
            color="gray"
            title="Privacy Information"
            description="When you generate a shortlink your code will be accessible to anyone that has the link."
            variant="subtle"
            class="!ring-0"
          />
        </div>
      </template>
    </UPopover>
  </div>
</template>
