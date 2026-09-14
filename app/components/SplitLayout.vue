<script setup lang="ts"></script>

<template>
  <div class="w-full max-w-screen-2xl mx-auto flex-col lg:flex-row flex items-stretch min-h-screen">
    <div class="flex flex-col gap-8 flex-1 pt-14 pb-20 lg:pb-32 px-6 lg:px-12 min-w-0">
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
                href="https://github.com/jsbenchmark"
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
            <!-- <span
              class="bg-[#ff8362] rounded-full uppercase text-[0.7rem] px-1.5 py-0 font-semibold text-black ml-2 inline-block"
              >New</span
            > -->
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
