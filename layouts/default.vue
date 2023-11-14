<script setup lang="ts">
useHead({
  htmlAttrs: {
    class: 'bg-gray-900 text-white font-sans overflow-x-hidden',
  },
})

useServerSeoMeta({
  ogTitle: 'JS Benchmark',
  description:
    'A straightforward JavaScript benchmarking tool with support for ES modules and libraries.',
  ogDescription:
    'A straightforward JavaScript benchmarking tool with support for ES modules and libraries.',
  keywords:
    'javascript, benchmark, js, performance, esm, module, library, measure, compare, testing, tool',
  author: 'pabue.co',
  ogImage: 'https://jsbenchmark.com/og.png',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div class="w-full max-w-screen-2xl mx-auto flex-col lg:flex-row flex items-stretch min-h-screen">
    <div class="flex flex-col gap-8 flex-1 pt-14 pb-20 lg:pb-32 px-6 lg:px-12">
      <div class="flex-col lg:flex-row flex justify-between lg:items-center">
        <div class="flex items-center">
          <button>
            <img src="/logo.svg" alt="JS Benchmark logo" class="h-8 mr-3" />
          </button>
          <div>
            <a
              href="/"
              class="text-base font-semibold text-[#ff8362] uppercase tracking-wider leading-none block"
            >
              jsbenchmark
            </a>
            <div class="text-xs text-left text-gray-400 leading-none tracking-wide mt-[0.2rem]">
              by
              <a href="https://pabue.co" target="_blank" class="transition hover:text-white"
                >pabue.co</a
              >
              on
              <a
                href="https://github.com/pabueco/jsbenchmark"
                target="_blank"
                class="transition hover:text-white"
                >github</a
              >
            </div>
          </div>
        </div>

        <div class="flex mt-6 lg:mt-0">
          <NuxtLink
            class="px-4 py-2 rounded-md hover:bg-gray-800 font-semibold text-gray-400 hover:text-white transition"
            to="/"
            active-class="text-white"
          >
            Benchmark
          </NuxtLink>
          <NuxtLink
            class="px-4 py-2 rounded-md hover:bg-gray-800 font-semibold text-gray-400 hover:text-white transition inline-flex items-center"
            to="/repl"
            active-class="text-white"
          >
            Repl
            <span
              class="bg-[#ff8362] rounded-full uppercase text-[0.7rem] px-1.5 py-0 font-semibold text-black ml-2 inline-block"
              >New</span
            >
          </NuxtLink>
        </div>
      </div>
      <slot name="default" />
    </div>

    <div
      class="lg:w-[400px] xl:w-[500px] lg:min-w-[400px] pb-10 lg:py-14 px-6 lg:px-12 relative shrink-0"
    >
      <div class="sticky top-14 z-10">
        <slot name="sidebar" />
      </div>

      <div
        class="hidden lg:block absolute z-0 pointer-events-none inset-0 -right-[100vw] bg-gray-950/50"
      ></div>
    </div>
  </div>
</template>

<style>
:root {
  color-scheme: dark;
}

input {
  max-width: none;
}

.text-shadow {
  --width: 2px;
  --width-negative: calc(var(--width) * -1);
  text-shadow: var(--width-negative) var(--width-negative) 0 #000, 0 var(--width-negative) 0 #000,
    var(--width) var(--width-negative) 0 #000, var(--width) 0 0 #000,
    var(--width) var(--width) 0 #000, 0 var(--width) 0 #000,
    var(--width-negative) var(--width) 0 #000, var(--width-negative) 0 0 #000;
}
</style>
