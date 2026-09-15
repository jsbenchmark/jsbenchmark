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
              class="text-base font-semibold text-salmon-700 dark:text-salmon-400 uppercase tracking-wider leading-none block"
            >
              jsbenchmark
            </a>
            <div class="text-xs text-left text-muted leading-none tracking-wide mt-[0.2rem]">
              by
              <a href="https://pabue.co" target="_blank" class="transition hover:text-highlighted"
                >pabue.co</a
              >
              on
              <a
                href="https://github.com/jsbenchmark"
                target="_blank"
                class="transition hover:text-highlighted"
                >github</a
              >
            </div>
          </div>

          <UColorModeSelect
            aria-label="Color theme"
            size="xs"
            class="relative ml-3 size-8 justify-center gap-0 rounded-full p-0 after:absolute after:-inset-1.5 after:content-['']"
            :content="{ side: 'bottom', align: 'start' }"
            :ui="{
              leading: 'static inset-auto p-0',
              value: 'sr-only',
              trailing: 'hidden',
              content: 'w-32',
            }"
          />
        </div>

        <div class="flex mt-6 lg:mt-0">
          <nav aria-label="Primary" class="flex">
            <NuxtLink
              class="px-4 py-2 rounded-md hover:bg-elevated font-semibold text-muted hover:text-highlighted transition"
              to="/"
              active-class="!text-highlighted"
            >
              Benchmark
            </NuxtLink>
            <NuxtLink
              class="px-4 py-2 rounded-md hover:bg-elevated font-semibold text-muted hover:text-highlighted transition inline-flex items-center"
              to="/repl"
              active-class="!text-highlighted"
            >
              Repl
              <!-- <span
                class="bg-salmon-400 rounded-full uppercase text-[0.7rem] px-1.5 py-0 font-semibold text-black ml-2 inline-block"
                >New</span
              > -->
            </NuxtLink>
          </nav>
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
        class="hidden lg:block absolute z-0 pointer-events-none inset-0 -right-[100vw] bg-muted dark:bg-gray-950/50"
      ></div>
    </div>
  </div>
</template>
