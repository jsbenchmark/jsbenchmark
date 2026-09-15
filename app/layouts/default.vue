<script setup lang="ts">
useHead({
  htmlAttrs: {
    class: 'bg-default text-default font-sans overflow-x-hidden',
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
</script>

<template>
  <div id="app">
    <slot />
  </div>
</template>

<style>
input {
  max-width: none;
}
</style>
