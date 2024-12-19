export const usePredefinedNotifications = () => {
  const toast = useToast()

  return {
    typescriptHint: () => {
      toast.add({
        title: 'Trying to run TypeScript?',
        description:
          'You can enable experimental TypeScript support to run your code. TypeScript will be transpiled to JavaScript before running.',
        icon: 'i-tabler-brand-typescript',
        timeout: 10_000,
        actions: [
          {
            label: 'Enable TypeScript (experimental)',
            click: () => {
              usePreferences().value.typescript = true
            },
            color: 'primary',
          },
        ],
      })
    },
  }
}
