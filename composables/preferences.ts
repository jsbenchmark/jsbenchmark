import { useStorage } from '@vueuse/core'

const preferences = useStorage(
  'jsbenchmark:preferences',
  {
    typescript: false,
  },
  undefined,
  { mergeDefaults: true }
)

export const usePreferences = () => {
  return preferences
}
