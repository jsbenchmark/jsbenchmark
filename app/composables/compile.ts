export const useCompile = () => {
  const preferences = usePreferences()

  const whenEnabled = async (props: { code: string }) => {
    if (!preferences.value.typescript) {
      return props.code
    }

    return compile(props)
  }

  return { whenEnabled }
}
