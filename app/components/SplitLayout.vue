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
              class="text-base font-bold text-salmon-700 dark:text-salmon-400 uppercase tracking-widest leading-none block"
            >
              jsbenchmark
            </a>
            <div class="text-xs text-left text-muted leading-none tracking-wide mt-[0.2rem]">
              by
              <a
                href="https://pabue.co"
                target="_blank"
                rel="noreferrer"
                class="transition hover:text-highlighted"
                >pabueco</a
              >
              /
              <a
                href="https://github.com/jsbenchmark/jsbenchmark"
                target="_blank"
                rel="noreferrer"
                class="transition hover:text-highlighted"
                >src</a
              >
              /
              <NuxtLink to="/changelog" class="transition text-neutral-300 hover:text-highlighted"
                >v2.0</NuxtLink
              >
            </div>
          </div>
        </div>

        <div class="flex mt-6 lg:mt-0">
          <nav aria-label="Primary" class="flex flex-wrap items-center">
            <NuxtLink
              class="px-3 py-2 sm:px-4 rounded-md hover:bg-elevated font-semibold text-muted hover:text-highlighted transition inline-flex items-center gap-2"
              to="/"
              active-class="!text-highlighted"
            >
              <UIcon name="i-tabler-chart-bar" class="size-4 shrink-0" aria-hidden="true" />
              Benchmark
            </NuxtLink>
            <NuxtLink
              class="px-3 py-2 sm:px-4 rounded-md hover:bg-elevated font-semibold text-muted hover:text-highlighted transition inline-flex items-center gap-2"
              to="/repl"
              active-class="!text-highlighted"
            >
              <UIcon name="i-tabler-terminal-2" class="size-4 shrink-0" aria-hidden="true" />
              Repl
            </NuxtLink>
            <NuxtLink
              class="px-3 py-2 sm:px-4 rounded-md hover:bg-elevated font-semibold text-muted hover:text-highlighted transition"
              to="/changelog"
              active-class="!text-highlighted"
            >
              News
            </NuxtLink>

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
          </nav>
        </div>
      </div>
      <slot name="default" />
    </div>

    <div
      v-if="$slots.sidebar"
      class="lg:w-[400px] xl:w-[500px] lg:min-w-[400px] pb-10 lg:py-14 px-6 lg:px-12 relative shrink-0"
    >
      <div class="sticky top-14 z-10">
        <slot name="sidebar" />
      </div>

      <div
        class="sidebar-background hidden lg:block absolute z-0 pointer-events-none inset-y-0 left-0 bg-muted dark:bg-gray-950/50"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-background {
  right: min(0px, calc((var(--breakpoint-2xl) - 100vw) / 2));
}
</style>
