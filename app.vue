<script setup lang="ts">
import { useWebWorkerFn } from "./utils/worker";
import "@fontsource-variable/jetbrains-mono";
import { IconPlus } from "@tabler/icons-vue";
import { Case, Dependency, TestState } from "types";
import { nanoid } from "nanoid";
import { clamp } from "@vueuse/core";
import { IconTrash } from "@tabler/icons-vue";
import slugify from "slugify";
import * as htmlToImage from "html-to-image";
import { IconShare } from "@tabler/icons-vue";
import { IconCheck } from "@tabler/icons-vue";
import { IconLink } from "@tabler/icons-vue";

const ADVANCED_EXAMPLE_URL =
  "/#eyJjYXNlcyI6W3siaWQiOiJTemFvbUxmNWhudG45UHY5SkplZnoiLCJjb2RlIjoic3RydWN0dXJlZENsb25lKERBVEEpIiwibmFtZSI6IlN0cnVjdHVyZWQgY2xvbmUifSx7ImlkIjoiZlJ2LUtWZFZ6LVlzejQ0VWF6RFZyIiwiY29kZSI6ImxvZGFzaC5jbG9uZURlZXAoREFUQSkiLCJuYW1lIjoiTG9kYXNoIiwiZGVwZW5kZW5jaWVzIjpbeyJ1cmwiOiJodHRwczovL2Nkbi5qc2RlbGl2ci5uZXQvbnBtL2xvZGFzaC1lc0A0LjE3LjIxLytlc20iLCJuYW1lIjoibG9kYXNoIiwiZXNtIjp0cnVlfV19LHsiaWQiOiJOdEpEMHh5Y0oyNl9LdUpyd1UyUGwiLCJjb2RlIjoiY29uc3QgeyBrbG9uYSB9ID0gS0xPTkFcbmtsb25hKERBVEEpIiwiZGVwZW5kZW5jaWVzIjpbeyJ1cmwiOiJodHRwczovL2Nkbi5qc2RlbGl2ci5uZXQvbnBtL2tsb25hQDIuMC42Lytlc20iLCJuYW1lIjoiS0xPTkEiLCJlc20iOnRydWV9XSwibmFtZSI6Imtsb25hIn0seyJpZCI6IlRyQ3Y2WVNTY1pnNTBtaVZGMEt3UyIsImNvZGUiOiJjbG9uZURlZXAoREFUQSkiLCJkZXBlbmRlbmNpZXMiOlt7InVybCI6Imh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9ucG0vY2xvbmUtZGVlcEA0LjAuMS8rZXNtIiwibmFtZSI6ImNsb25lRGVlcCIsImVzbSI6dHJ1ZX1dLCJuYW1lIjoiY2xvbmUtZGVlcCJ9LHsiaWQiOiJ3X2oyNGNYQjlxc0RkU0ttc2VTQXciLCJjb2RlIjoiSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShEQVRBKSkiLCJkZXBlbmRlbmNpZXMiOltdLCJuYW1lIjoiSlNPTi5wYXJzZSJ9XSwiY29uZmlnIjp7Im5hbWUiOiJDbG9uaW5nIGEgbGFyZ2UgYXJyYXkgb2Ygb2JqZWN0cyIsInBhcmFsbGVsIjp0cnVlLCJnbG9iYWxUZXN0Q29uZmlnIjp7ImRlcGVuZGVuY2llcyI6W3sidXJsIjoiaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0L25wbS9AZmFrZXItanMvZmFrZXJAOC4wLjIvK2VzbSIsIm5hbWUiOiJGQUtFUiIsImVzbSI6dHJ1ZX1dfSwiZGF0YUNvZGUiOiJjb25zdCB7IGZha2VyIH0gPSBGQUtFUlxuXG5mdW5jdGlvbiBjcmVhdGVSYW5kb21Vc2VyKCkge1xuICByZXR1cm4ge1xuICAgIHVzZXJJZDogZmFrZXIuc3RyaW5nLnV1aWQoKSxcbiAgICB1c2VybmFtZTogZmFrZXIuaW50ZXJuZXQudXNlck5hbWUoKSxcbiAgICBlbWFpbDogZmFrZXIuaW50ZXJuZXQuZW1haWwoKSxcbiAgICBhdmF0YXI6IGZha2VyLmltYWdlLmF2YXRhcigpLFxuICAgIHBhc3N3b3JkOiBmYWtlci5pbnRlcm5ldC5wYXNzd29yZCgpLFxuICAgIGJpcnRoZGF0ZTogZmFrZXIuZGF0ZS5iaXJ0aGRhdGUoKSxcbiAgICByZWdpc3RlcmVkQXQ6IGZha2VyLmRhdGUucGFzdCgpLFxuICB9O1xufVxuXG5yZXR1cm4gREFUQSA9IGZha2VyLmhlbHBlcnMubXVsdGlwbGUoY3JlYXRlUmFuZG9tVXNlciwge1xuICBjb3VudDogMTAwLFxufSk7In19";

const title = computed(() => config.value.name);

const config = ref({
  name: "Simple example test",
  parallel: true,
  globalTestConfig: {
    dependencies: [] as Dependency[],
  } as Case,
  dataCode: "return [...Array(1000).keys()]",
});

useHead({
  title,
  titleTemplate: (sub) => {
    return sub ? `${sub} - JS Benchmark` : "JS Benchmark";
  },
  htmlAttrs: {
    class: "bg-gray-900 text-white font-sans overflow-x-hidden",
  },
  meta: [
    {
      name: "description",
      content:
        "A straight forward JavaScript benchmarking tool with support for ES modules and libraries.",
    },
    {
      name: "keywords",
      content:
        "javascript, benchmark, js, performance, esm, module, library, measure, compare, testing, tool",
    },
    {
      name: "author",
      content: "pabue.co",
    },
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1.0",
    },
  ],
});

const cases = ref<Case[]>([
  {
    id: nanoid(),
    code: "DATA.find(i => i === 99)",
    name: "Find 99",
    // dependencies: [{ url: "", name: "" }],
  },
  {
    id: nanoid(),
    code: "DATA.find(i => i === 499)",
    name: "Find 499",
    // dependencies: [{ url: "", name: "" }],
  },
  {
    id: nanoid(),
    code: "DATA.find(i => i === 999)",
    name: "Find 999",
    // dependencies: [{ url: "", name: "" }],
  },
  // {
  //   esm: true,
  //   dependencies: ["https://cdn.jsdelivr.net/npm/destr@2.0.0/+esm"],
  //   code: "DEP_0.destr(data)",
  // },
]);

const stateByTest = ref<Record<string, TestState>>({});

// import('https://cdn.jsdelivr.net/npm/destr@2.0.0/+esm').then(({destr}) => destr(data));

// const WARMUP_ITERATIONS = 100;
const ITERATIONS = 10_000;
const TIME = 3000;

const runCase = async (c: Case) => {
  stateByTest.value[c.id] = {
    status: "running",
    error: null,
  };

  const dependencies = [
    ...(config.value.globalTestConfig.dependencies || []),
    ...(c.dependencies || []),
  ].filter((d) => d.url);

  const { workerFn, workerStatus, workerTerminate } = useWebWorkerFn(
    async ({ iterations, code, dataCode, time }, d?: any) => {
      // const timings = [];

      const AsyncFunction = Object.getPrototypeOf(
        async function () {}
      ).constructor;
      const dataFn = AsyncFunction(dataCode);
      const data = await dataFn(d);

      (globalThis as any).DATA = data;

      const fn = AsyncFunction(code);

      // for (const [index, dependency] of dependencies.entries()) {
      //   const dep = await import(/* @vite-ignore */ dependency);
      //   (globalThis as any)[`DEP_${index}`] = dep;
      // }

      // Warmup.
      let warmupTimes = 0;
      const warmupStart = Date.now();

      while (Date.now() - warmupStart < 500) {
        await fn();
        warmupTimes++;
      }

      // Run fixed times.
      // for (let i = 0; i < iterations; i++) {
      //   const start = performance.now();
      //   const result = await fn(data);
      //   const end = performance.now();

      //   timings.push(end - start);
      // }

      // Run for fixed time.
      let times = 0;
      const start = Date.now();

      while (Date.now() - start < time) {
        await fn();
        times++;
      }

      return {
        times,
        // timings,
      };
    },
    {
      timeout: 5000,
      dependencies: unref(dependencies),
      esm: dependencies.some((d) => d.esm),
    }
  );

  let res;
  try {
    res = await workerFn({
      code: c.code,
      iterations: ITERATIONS,
      dataCode: config.value.dataCode,
      time: TIME,
    });
    // const average = res.timings.reduce((a, b) => a + b, 0) / ITERATIONS;
    // const opsPerSecond = 1000 / average;
    const opsPerSecond = Math.round(res.times / (TIME / 1000));

    const averageTime = 1000 / opsPerSecond;
    let averageTimeFormatted = averageTime.toFixed(2);

    const isSubSecond = averageTime < 1;

    if (isSubSecond) {
      const zeroCountAfterDot = averageTime
        .toString()
        .match(/\.(0+)/)?.[1].length;
      averageTimeFormatted = averageTime.toFixed((zeroCountAfterDot || 0) + 2);
    }

    stateByTest.value[c.id] = {
      status: "success",
      error: null,
      result: {
        opsPerSecond,
        averageTime,
        averageTimeFormatted,
      },
    };
  } catch (e) {
    const error = e as Error;
    console.error(`Worker failed with error: ${error.message}`);
    stateByTest.value[c.id] = {
      status: "error",
      error: error,
      result: undefined,
    };
  }
};

const isRunningAllTests = ref(false);
const run = async () => {
  isRunningAllTests.value = true;
  if (config.value.parallel) {
    await Promise.all(cases.value.map(runCase));
  } else {
    for (const c of cases.value) {
      await runCase(c);
    }
  }
  isRunningAllTests.value = false;
};

const serializeState = () => {
  const state = {
    cases: cases.value,
    config: config.value,
  };

  const string = JSON.stringify(state);

  const encoded = btoa(string);

  return encoded;
};

const readStateFromUrl = (encoded: string) => {
  if (!encoded) return;
  const string = atob(encoded);

  const state = JSON.parse(string);

  cases.value = state.cases;
  config.value = state.config;
};

watch(
  [cases, config],
  () => {
    const encoded = serializeState();

    useRouter().replace({
      hash: `#${encoded}`,
    });
  },
  { deep: true }
);

const addCase = () => {
  cases.value.push({
    id: nanoid(),
    code: "",
    dependencies: [],
  });
};
const removeCase = (c: Case) => {
  if (!confirm("Are you sure?")) return;
  cases.value = cases.value.filter((x) => x !== c);
};

const route = useRoute();
onMounted(() => {
  readStateFromUrl(route.hash.slice(1));
});

const isAnyTestRunning = computed(() => {
  return cases.value.some((c) => {
    const state = stateByTest.value[c.id];
    return state?.status === "running";
  });
});

const allTestsHaveResults = computed(() => {
  return cases.value.every((c) => {
    const state = stateByTest.value[c.id];
    return state?.status === "success" || state?.status === "error";
  });
});

const exportViewRef = ref<HTMLElement | null>(null);
const isExporting = ref(false);

const exportResults = async () => {
  isExporting.value = true;
  await nextTick();

  // Fix fonts: https://github.com/bubkoo/html-to-image/issues/49#issuecomment-762222100
  const dataUrl = await htmlToImage.toPng(exportViewRef.value!, {
    canvasWidth: 1600 * 2,
    canvasHeight: 900 * 2,
  });
  const link = document.createElement("a");
  link.download = `${slugify(config.value.name).toLowerCase()}.png`;
  link.href = dataUrl;
  link.click();

  setTimeout(() => {
    isExporting.value = false;
  }, 1000);
};

const clipboard = useClipboard();
const { share, isSupported: isShareSupported } = useShare();

function startShare() {
  share({
    title: "jsbenchmark.com",
    text: `Check out this benchmark on jsbenchmark.com!`,
    url: location.href,
  });
}

const getUrl = () => {
  return window.location.href;
};

const clear = () => {
  // if (!confirm("Are you sure?")) return;
  cases.value = [];
  config.value = {
    name: "",
    parallel: true,
    dataCode: "",
    globalTestConfig: {
      dependencies: [] as Dependency[],
    } as Case,
  };
};
</script>

<template>
  <div class="w-full max-w-screen-2xl mx-auto flex items-stretch min-h-screen">
    <div class="flex flex-col gap-8 flex-1 py-14 px-12">
      <div class="flex justify-between items-center">
        <div class="flex items-center">
          <button @click="clear">
            <img src="/logo.svg" alt="JS Benchmark logo" class="h-8 mr-3" />
          </button>
          <div>
            <div
              class="text-base font-semibold text-[#ff8362] uppercase tracking-wider leading-none"
            >
              jsbenchmark
            </div>
            <div
              class="text-xs text-left text-gray-400 leading-none tracking-wide mt-0.5"
            >
              by
              <a
                href="https://pabue.co"
                target="_blank"
                class="transition hover:text-white"
                >pabue.co</a
              >
            </div>
          </div>
        </div>

        <div class="flex space-x-5">
          <button
            class="font-medium text-gray-400 transition hover:text-white text-sm"
            @click="clear"
          >
            Clear
          </button>
          <a
            class="font-medium text-gray-400 transition hover:text-white text-sm"
            target="_blank"
            :href="ADVANCED_EXAMPLE_URL"
          >
            View advanced example
          </a>
        </div>
      </div>

      <div class="flex justify-between items-start">
        <BaseInput
          v-model="config.name"
          placeholder="Name"
          blendin
          class="text-[2.3rem] font-bold flex-1"
          type="textarea"
        />

        <div class="ml-10 mt-1.5 h-[50px] flex gap-3">
          <BaseButton
            @click="isShareSupported ? startShare() : clipboard.copy(getUrl())"
            :disabled="isAnyTestRunning"
            class="!px-0 aspect-square"
            outline
          >
            <IconShare v-if="isShareSupported" />
            <IconLink v-else-if="!clipboard.copied.value" />
            <IconCheck v-else />
          </BaseButton>
          <BaseButton
            @click="run"
            :loading="isRunningAllTests"
            :disabled="isAnyTestRunning"
            class="text-lg px-6"
            >Run all</BaseButton
          >
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="text-2xl font-bold">Setup</h3>
        <p class="text-gray-400 text-sm">
          This setup function should return the stuff you need in the tests.
          Anything returned will be available via the
          <code class="text-white">DATA</code>
          variable inside the test cases. Running the setup function is not part
          of the benchmark and it's run separately for each test case.
        </p>
        <BaseCodeEditor v-model="config.dataCode" />
        <Dependencies v-model:test="config.globalTestConfig" global>
          <template #help>
            <p>
              Global dependencies are available in the setup function and every
              test case.
            </p>
          </template>
        </Dependencies>
      </div>

      <div class="flex justify-between items-center">
        <h3 class="text-2xl font-bold">Test cases</h3>
        <div>
          <BaseButton :icon="IconPlus" outline @click="addCase">
            <span>Add case</span>
          </BaseButton>
        </div>
      </div>

      <div
        v-for="(c, index) of cases"
        :key="index"
        class="border rounded-xl border-gray-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <BaseInput
            v-model="c.name"
            placeholder="Name"
            blendin
            class="text-xl font-semibold"
          />
          <!-- <button
            @click="removeCase(c)"
            class="text-gray-500 hover:text-white transition"
          >
            <IconX />
          </button> -->
          <div class="flex justify-end space-x-4 h-10">
            <div
              class="rounded-md h-full px-0 mr-2 -border -bg-gray-800 flex items-center"
            >
              <div class="flex items-center font-mono space-x-2 text-sm">
                <div class="text-gray-400">Ops/s:</div>
                <div>
                  {{
                    stateByTest[c.id]?.result
                      ? Number(
                          stateByTest[c.id]?.result?.opsPerSecond
                        ).toLocaleString()
                      : "?"
                  }}
                </div>
              </div>

              <!-- <div
                class="border-l border-gray-800 h-full flex items-center justify-center"
              >
                <IconPlayerPlay />
                <span>Run</span>
              </div> -->
            </div>
            <BaseButton
              @click="runCase(c)"
              :loading="stateByTest[c.id]?.status === 'running'"
              outline
              >Run</BaseButton
            >
            <BaseButton
              @click="removeCase(c)"
              class="!bg-transparent border border-gray-700 px-0 aspect-square text-gray-400"
            >
              <IconTrash :size="20" />
            </BaseButton>
          </div>
        </div>
        <BaseCodeEditor v-model="c.code" />

        <Dependencies v-model:test="cases[index]" />

        <div
          v-if="stateByTest[c.id]?.status === 'error'"
          class="bg-red-600/10 text-red-500 rounded-md px-4 py-3 font-mono border border-red-600"
        >
          {{ stateByTest[c.id]?.error?.message }}
        </div>
      </div>

      <!-- <label>
        <input type="checkbox" v-model="config.parallel" />
        Run in parallel (experimental)
      </label> -->
    </div>

    <div class="w-[500px] min-w-[400px] py-14 px-12 relative">
      <div class="sticky top-14 z-10">
        <div class="flex justify-between items-center mb-12">
          <h2 class="text-3xl font-bold">Results</h2>
          <div>
            <BaseButton
              @click="exportResults"
              :loading="isExporting"
              :disabled="!allTestsHaveResults"
              outline
              class="!h-8 !px-3 text-sm"
              >Share</BaseButton
            >
          </div>
        </div>

        <Results :cases="cases" :state-by-test="stateByTest" />

        <div class="mt-24 text-gray-400 text-sm">
          <p>
            <span class="font-bold">Note:</span> No statistical analysis is used
            to validate the results. The tests are run in parallel for 3 seconds
            (with a 500ms warmup) and then operations per second are calculated.
          </p>
        </div>
      </div>

      <div
        class="absolute z-0 pointer-events-none inset-0 -right-[100vw] bg-gray-950/50"
      ></div>
    </div>

    <div
      v-if="isExporting"
      class="fixed -left-[1000000px] pointer-events-none flex items-center justify-center"
    >
      <div
        ref="exportViewRef"
        class="w-[1600px] h-[900px] rounded-xl bg-gray-900 p-20 flex flex-col justify-center"
        :style="{
          fontSize: `${clamp(
            40 * (2 / Math.max(cases.length, 2)) * 0.95,
            10,
            35
          )}px`,
        }"
      >
        <h1 class="font-extrabold text-[2.6em] mb-[0.75em] leading-none">
          {{ config.name }}
        </h1>
        <Results :cases="cases" :state-by-test="stateByTest" />
        <div
          class="absolute top-0 right-0 bg-gray-800 rounded-bl-md text-sm px-4 py-2 text-gray-400 tracking-wide font-medium"
        >
          <span>Powered by</span>
          <span class="text-gray-300 inline-block ml-1">jsbenchmark.com</span>
        </div>
      </div>
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

.striped {
  background-size: 2em 2em;
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.05) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0.05) 75%,
    transparent 75%,
    transparent
  );
}

.striped-animated {
  animation: 350ms linear 0s infinite normal none running stripes-animation;
}

@keyframes stripes-animation {
  0% {
    background-position: 0 0;
  }

  100% {
    background-position: 2rem 0;
  }
}

.text-shadow {
  --width: 2px;
  --width-negative: calc(var(--width) * -1);
  text-shadow: var(--width-negative) var(--width-negative) 0 #000,
    0 var(--width-negative) 0 #000, var(--width) var(--width-negative) 0 #000,
    var(--width) 0 0 #000, var(--width) var(--width) 0 #000,
    0 var(--width) 0 #000, var(--width-negative) var(--width) 0 #000,
    var(--width-negative) 0 0 #000;
}
</style>
