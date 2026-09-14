<script setup lang="ts">
useHead({
  htmlAttrs: {
    class: 'bg-zinc-900 text-white font-sans overflow-x-hidden',
  },
  meta: [
    {
      name: 'keywords',
      content:
        'javascript, benchmark, online, js, performance, esm, module, library, measure, compare, testing, tool, repl, share, open source',
    },
  ],
})

useServerSeoMeta({
  ogTitle: 'JS Benchmark',
  description:
    'A straightforward online JavaScript benchmarking tool and REPL with support for ES modules and libraries.',
  ogDescription:
    'A straightforward online JavaScript benchmarking tool and REPL with support for ES modules and libraries.',
  author: 'pabue.co',
  ogImage: 'https://jsbenchmark.com/og.png',
  twitterCard: 'summary_large_image',
})

onMounted(() => {
  const colorMode = useColorMode()
  if (colorMode.value !== 'dark') {
    colorMode.preference = 'dark'
  }
})
</script>

<template>
  <div id="app">
    <slot />
  </div>
</template>

<style>
:root {
  color-scheme: dark;
}

input {
  max-width: none;
}
</style>
