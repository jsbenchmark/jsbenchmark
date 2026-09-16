<script setup lang="ts">
useHead({
  title: "What's new in v2.0 - JS Benchmark",
  meta: [
    {
      name: 'description',
      content: 'See what changed in JS Benchmark v2.0.',
    },
  ],
})
</script>

<template>
  <SplitLayout>
    <template #default>
      <main class="max-w-3xl">
        <h1 class="text-4xl font-bold tracking-tight">What's new in v2.0</h1>
        <p class="mt-5 text-lg leading-relaxed text-toned">
          Version 2.0 is a major update to benchmarking and the REPL. It expands the kinds of code
          you can test, makes results more useful, and gives you better tools to inspect and share
          each run.
        </p>

        <section class="mt-10" aria-labelledby="benchmark-changes">
          <h2 id="benchmark-changes" class="text-2xl font-bold">Benchmarking</h2>
          <p class="mt-3 leading-relaxed text-toned">
            Benchmarking now uses a new measurement engine, provides richer statistics, and includes
            better controls for longer or more detailed runs. The highlight is the entirely new,
            long-requested DOM mode: you can finally measure code that uses real browser APIs and
            HTML, while Worker mode remains available for pure JavaScript/TypeScript tests.
          </p>
          <ul class="mt-5 list-disc space-y-3 pl-6 leading-relaxed marker:text-primary">
            <li>
              Run DOM benchmarks with browser APIs and an optional HTML fixture. Every case gets a
              fresh sandboxed frame.
            </li>
            <li>
              Choose Quick, Standard, or Extended run lengths, then run cases sequentially or in
              parallel.
            </li>
            <li>
              Measure calibrated batches after a dedicated warmup and track live progress during the
              run.
            </li>
            <li>
              Compare median, p95, standard deviation, 95% RME, and sample counts alongside ops/s.
            </li>
            <li>
              Export a PNG or copy results as Markdown, CSV, or JSON. PNG exports can include
              statistics and optional device and browser details.
            </li>
            <li>
              Keep run controls available while scrolling, and follow the system theme or choose a
              light or dark theme.
            </li>
          </ul>
        </section>

        <section class="mt-12" aria-labelledby="repl-changes">
          <h2 id="repl-changes" class="text-2xl font-bold">REPL</h2>
          <p class="mt-3 leading-relaxed text-toned">
            The REPL has grown from a simple result viewer into a more complete environment for
            browser experiments. It now supports DOM previews and shows the details of a run as they
            happen instead of only returning the final value.
          </p>
          <ul class="mt-5 list-disc space-y-3 pl-6 leading-relaxed marker:text-primary">
            <li>
              Choose Worker or DOM mode. DOM mode adds an HTML fixture and a fresh sandboxed
              preview.
            </li>
            <li>Stream results, console output, errors, and timing markers.</li>
            <li>Copy the latest results/investigation as Markdown.</li>
          </ul>
        </section>
      </main>
    </template>

    <template #sidebar>
      <aside aria-labelledby="release-summary-heading">
        <p class="text-sm font-semibold uppercase tracking-wider text-primary">v2.0</p>
        <h2 id="release-summary-heading" class="mt-2 text-3xl font-bold">Release summary</h2>
        <p class="mt-4 leading-relaxed text-toned">
          New DOM execution, more accurate measurements, richer exports, and expanded REPL output.
        </p>

        <nav class="mt-10" aria-label="Changelog sections">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-muted">On this page</h3>
          <ul class="mt-3 space-y-1">
            <li>
              <a
                href="#benchmark-changes"
                class="block rounded-md px-3 py-2 font-semibold text-muted transition hover:bg-elevated hover:text-highlighted"
              >
                Benchmarking
              </a>
            </li>
            <li>
              <a
                href="#repl-changes"
                class="block rounded-md px-3 py-2 font-semibold text-muted transition hover:bg-elevated hover:text-highlighted"
              >
                REPL
              </a>
            </li>
          </ul>
        </nav>
      </aside>
    </template>
  </SplitLayout>
</template>
