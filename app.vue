<script setup lang="ts">
import { useWebWorkerFn } from "./utils/worker";
// Supports weights 100-800
import "@fontsource-variable/jetbrains-mono";
import { IconX } from "@tabler/icons-vue";
import { Case, Dependency, TestState } from "types";
import { nanoid } from "nanoid";
import { clamp } from "@vueuse/core";

useHead({
  title: "Web Worker",
  htmlAttrs: {
    class: "bg-gray-900 text-white font-sans",
  },
});

const config = ref({
  name: "Test 123",
  parallel: false,
  globalTestConfig: {
    dependencies: [] as Dependency[],
  } as Case,
  dataCode: "return [...Array(1000).keys()]",
});

const cases = ref<Case[]>([
  {
    id: nanoid(),
    code: "DATA.find(i => i === 1)",
    // dependencies: [{ url: "", name: "" }],
  },
  {
    id: nanoid(),
    code: "DATA.find(i => i === 999)",
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

const result = ref(null);

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
      const timings = [];

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

      for (let i = 0; i < 100; i++) {
        await fn(data);
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
        timings,
      };
    },
    {
      timeout: 5000,
      dependencies: unref(dependencies),
      esm: dependencies.some((d) => d.esm),
    }
  );

  const res = await workerFn(
    {
      code: c.code,
      iterations: ITERATIONS,
      dataCode: config.value.dataCode,
      time: TIME,
    }
    // data.value
  );

  const average = res.timings.reduce((a, b) => a + b, 0) / ITERATIONS;

  // const opsPerSecond = 1000 / average;
  const opsPerSecond = Math.round(res.times / (TIME / 1000));

  console.log({ ...res, average, opsPerSecond });

  stateByTest.value[c.id] = {
    status: "success",
    error: null,
    result: {
      opsPerSecond,
    },
  };
};

const run = async () => {
  if (config.value.parallel) {
    await Promise.all(cases.value.map(runCase));
  } else {
    for (const c of cases.value) {
      await runCase(c);
    }
  }
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

const removeCase = (c: Case) => {
  if (!confirm("Are you sure?")) return;
  cases.value = cases.value.filter((x) => x !== c);
};

onMounted(() => {
  readStateFromUrl(useRoute().hash.slice(1));
});

const maxOpsPerSecond = computed(() => {
  return Math.max(
    ...cases.value.map((c) => {
      const state = stateByTest.value[c.id];
      if (!state || state.status !== "success") return 0;
      return state.result?.opsPerSecond || 0;
    })
  );
});

const getColorByPercentage = (percentage: number) => {
  const hue = percentage * 120;
  return `hsl(${hue}, 100%, 50%)`;
};

const getOpacityByPercentage = (percentage: number) => {
  return clamp(percentage, 0.2, 1);
};
</script>

<template>
  <div class="w-full flex gap-8 items-stretch min-h-screen">
    <div class="flex flex-col gap-8 flex-1 py-14 px-8">
      <!-- <textarea v-model="dataCode" class="w-full" /> -->
      <BaseInput
        v-model="config.name"
        placeholder="Name"
        blendin
        class="text-[2.6rem] font-bold"
      />

      <div>
        <h3 class="text-2xl font-bold">Setup</h3>
        <p class="text-gray-400">
          Anything returned from this setup function will be available via the
          <code class="bg-gray-700 px-2 rounded text-white">DATA</code>
          variable inside the test cases.
        </p>
        <BaseCodeEditor v-model="config.dataCode" />
        <Dependencies v-model:test="config.globalTestConfig" />
      </div>

      <h3 class="text-2xl font-bold">Test cases</h3>

      <div
        v-for="(c, index) of cases"
        :key="index"
        class="border rounded-xl border-gray-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <BaseInput v-model="c.name" placeholder="Name" blendin />
          <button
            @click="removeCase(c)"
            class="text-gray-500 hover:text-white transition"
          >
            <IconX />
          </button>
        </div>
        <BaseCodeEditor v-model="c.code" />

        <Dependencies v-model:test="cases[index]" />

        <div class="flex justify-end space-x-4">
          <div
            class="rounded-md h-11 px-3 border border-gray-800 flex items-center"
          >
            Ops/s:
            {{
              stateByTest[c.id]?.result
                ? Number(
                    stateByTest[c.id]?.result?.opsPerSecond
                  ).toLocaleString()
                : "0"
            }}
          </div>
          <BaseButton
            @click="runCase(c)"
            :loading="stateByTest[c.id]?.status === 'running'"
            >Run</BaseButton
          >
        </div>
      </div>

      <BaseButton @click="cases.push({ id: nanoid(), code: '' })"
        >Add case</BaseButton
      >

      <label>
        <input type="checkbox" v-model="config.parallel" />
        Run in parallel (experimental)
      </label>

      <BaseButton @click="run">Run all</BaseButton>
    </div>

    <div class="bg-gray-950/50 w-[500px] py-14 px-10 relative">
      <div class="sticky top-14">
        <h2 class="text-3xl font-bold mb-8">Results</h2>

        <div class="w-full space-y-6">
          <div v-for="(test, i) in cases" :key="test.id">
            <div class="flex justify-between items-center text-lg mb-1">
              <div class="mb-2 font-medium">
                {{ test.name || `Test #${i + 1}` }}
              </div>
              <div class="font-mono">
                {{
                  stateByTest[test.id]?.result?.opsPerSecond?.toLocaleString()
                }}
              </div>
            </div>
            <div class="relative">
              <div
                class="bg-white rounded-md h-11 transition-all duration-500 striped"
                :class="{
                  'bg-gray-800 striped-animated':
                    stateByTest[test.id]?.status === 'running',
                  'bg-red-600': stateByTest[test.id]?.status === 'error',
                }"
                :style="{
                  opacity:
                    stateByTest[test.id]?.status === 'success'
                      ? getOpacityByPercentage(
                          (stateByTest[test.id]?.result?.opsPerSecond || 0) /
                            maxOpsPerSecond
                        )
                      : 1,
                  width: !stateByTest[test.id]?.result
                    ? '100%'
                    : ((stateByTest[test.id]?.result?.opsPerSecond || 0) /
                        maxOpsPerSecond) *
                        100 +
                      '%',
                }"
              ></div>
              <!-- <div
                class="absolute right-0 bottom-0 text-white z-10 text-shadow text-xl font-mono"
              >
                {{
                  stateByTest[test.id]?.result?.opsPerSecond?.toLocaleString()
                }}
              </div> -->
            </div>
            <hr v-if="i < cases.length - 1" class="mt-8 border-gray-800" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  color-scheme: dark;
}

textarea {
  @apply font-mono;
}

input {
  max-width: none;
}

.striped {
  background-size: 2rem 2rem;
  background-image: linear-gradient(
    45deg,
    rgba(0, 0, 0, 0.05) 25%,
    transparent 25%,
    transparent 50%,
    rgba(0, 0, 0, 0.05) 50%,
    rgba(0, 0, 0, 0.05) 75%,
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
