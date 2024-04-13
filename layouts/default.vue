<script setup lang="ts">
useHead({
  htmlAttrs: {
    class: 'bg-gray-900 text-white font-sans overflow-x-hidden',
  },
})

useServerSeoMeta({
  ogTitle: 'JS Benchmark',
  description:
    'A straightforward online JavaScript benchmarking tool and REPL with support for ES modules and libraries.',
  ogDescription:
    'A straightforward online JavaScript benchmarking tool and REPL with support for ES modules and libraries.',
  keywords:
    'javascript, benchmark, online, js, performance, esm, module, library, measure, compare, testing, tool, repl, share, open source',
  author: 'pabue.co',
  ogImage: 'https://jsbenchmark.com/og.png',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div id="app">
    <NuxtPage />
  </div>
</template>

<style>
:root {
  color-scheme: dark;
}

input {
  max-width: none;
}

.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.list-leave-active {
  position: absolute;
  width: 100%;
  z-index: -1;
}
</style>
