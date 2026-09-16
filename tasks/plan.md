# Implementation Plan: Separate-Window DOM Benchmark Runner

## Overview

Add a `DOM` benchmark environment alongside the existing `Worker` environment. A DOM run opens one dedicated runner window from the user's click, communicates with it over a per-run `BroadcastChannel`, and executes each case in a fresh visible iframe using `sandbox="allow-scripts"`. Cases follow the existing parallel setting and may instead run sequentially when it is disabled. DOM mode also adds an optional HTML fixture alongside the existing JavaScript setup. The existing benchmark timing and statistics engine is shared by both environments.

The worker environment remains the default and retains its current parallel behavior. The DOM environment exists for cases that need APIs such as `window`, `document`, `new Image()`, or layout. Parallel scheduling is available for experimentation while keeping document state isolated per frame; sequential scheduling remains the lower-contention choice.

## Product Intent

- Restore the browser APIs users reasonably expect from a browser benchmarking site without weakening the existing Worker experience.
- Keep Worker mode fast, parallel-capable, and unchanged by default; DOM mode is an explicit opt-in for browser-document behavior.
- Keep the main benchmark page usable while DOM code runs, while being honest that browsers do not guarantee an independent OS process or unthrottled background execution.
- Preserve the existing parallel preference in both runtimes. DOM cases always receive isolated frames, while the UI makes clear that sequential scheduling avoids contention within the shared runner renderer.
- Make setup understandable to users who need both markup and code. HTML defines the fixture; JavaScript initializes it and returns `DATA`.
- Keep the first release focused. Do not turn this into a general browser automation, rendering-profiler, or multi-window orchestration system.

## Agent Handoff: Start Here

1. Read this plan and `tasks/todo.md`, then inspect the actual versions of the files listed under “Relevant Source Map”; repository state is authoritative if it has moved.
2. Run `git status --short`, `pnpm test`, and `pnpm typecheck` before editing. The recorded baseline commit is `30cd3b1`; only `tasks/` was untracked when this plan was finalized.
3. Implement Tasks 1–5 in order. Do not start page-level integration before the sandbox/protocol checkpoint passes in a real browser.
4. Preserve current benchmark behavior unless this plan explicitly says otherwise. In particular, do not change timings, sampling/statistics, Worker parallelism, or compilation semantics as incidental cleanup.
5. Keep user-authored strings out of generated harness source. Transfer code, HTML, dependency URLs, and names as structured data after the frame is loaded.
6. Check off a task only after its focused tests and manual checks pass. Do not commit or merge unless separately authorized.

## Relevant Source Map

| File                                      | Responsibility / reason to read                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/pages/index.vue`                     | Current configuration, compilation, Worker creation, single/all orchestration, URL persistence, run controls, settings, and methodology copy. |
| `app/utils/benchmark/run.ts`              | Self-contained benchmark engine to reuse in both environments.                                                                                |
| `app/utils/benchmark/modes.ts`            | Run budgets and timeout derivation.                                                                                                           |
| `app/utils/benchmark/summary.ts`          | Converts raw measurements into the result/statistics shape.                                                                                   |
| `app/utils/worker/index.ts`               | Existing one-shot Worker lifecycle and timeout behavior.                                                                                      |
| `app/utils/worker/lib/depsParser.ts`      | Existing classic/ESM dependency semantics and global naming.                                                                                  |
| `app/components/BaseCodeEditor.vue`       | Current JavaScript/TypeScript CodeMirror configuration; extend rather than duplicate it.                                                      |
| `app/components/TestCases.vue`            | Per-case Run controls that need DOM-mode concurrency disabling.                                                                               |
| `app/composables/benchmark-run-status.ts` | Existing run progress toast and parallel/sequential wording.                                                                                  |
| `app/types/index.ts`                      | Serialized `Config`, `TestCase`, and UI result state.                                                                                         |
| `app/utils/benchmark/run.test.ts`         | Timing invariants and serialized-function coverage that must remain green.                                                                    |

## Revalidated Baseline

- Stack: Nuxt `4.5.2`, Nuxt UI `4.11.1`, Vue through Nuxt, TypeScript `6.0.3`, and Vitest `5.0.0`.
- `app/utils/benchmark/run.ts` contains a self-contained function that is serialized into a worker. It performs per-case setup, calibrates toward a 40 ms batch target, warms up, then records elapsed time and per-operation batch samples.
- Run modes are currently Quick (1 s + 250 ms warmup), Standard (3 s + 500 ms), and Extended (8 s + 1 s). Timeout is measurement + warmup + 2 s.
- Each worker case gets its own global `DATA`. Cases run in parallel by default, with an existing sequential option.
- Classic dependencies use `importScripts`; ESM dependencies are imported into a module worker and exposed on `globalThis` under their configured names.
- Shared URLs serialize `config`, so a new execution-environment field needs an explicit fallback for older URLs.
- Baseline on 2026-09-15: all 36 tests in 8 files pass, and `pnpm typecheck` passes.
- Adaptive color-theme work landed during planning as commit `30cd3b1`, including changes in `app/pages/index.vue`. The plan targets that committed state; only the new `tasks/` files are currently untracked.

## Assumptions and Scope

1. `Worker` remains the default for new benchmarks and older shared URLs.
2. One user click opens at most one runner window. A “Run all” action reuses that window and creates a fresh sandboxed iframe for each case.
3. DOM cases are sequential when `parallel` is disabled and concurrent when it is enabled. Concurrent cases still use independent frames but share one runner renderer, so the UI explains the contention tradeoff.
4. The existing setup editor remains JavaScript and continues to create `DATA`. DOM mode adds a separate optional `setupHtml` body-fragment editor; switching one editor between JavaScript and HTML would make it impossible to use both forms of setup together.
5. The REPL remains worker-only. The requested selector and DOM runner apply to the benchmark page.
6. No cancellation UI, configurable viewport, multi-window parallel DOM mode, or dedicated runner subdomain is included initially.
7. A browser may present `window.open()` as a tab rather than a standalone OS window. The UI and errors should say “runner window” without depending on exact browser chrome.
8. Moving the runner behind the main page is allowed, but background/minimized windows may be deprioritized and timers or `requestAnimationFrame` may be throttled. The methodology copy will state this rather than blocking background execution.

## Architecture

```text
Benchmark page
  - compiles TypeScript
  - owns case state/results
  - opens one runner with `noopener`
          |
          | random per-run BroadcastChannel
          v
Trusted Nuxt runner page
  - never evaluates user code itself
  - owns status/lifecycle
  - creates one frame per case
          |
          | transferred MessagePort
          v
Visible sandboxed iframe (`allow-scripts` only)
  - opaque origin
  - installs the optional HTML fixture
  - loads declared dependencies
  - creates DATA and runs the shared benchmark engine
  - returns a structured result/error
```

### Module ownership

- `dom/session.ts` owns the parent-side channel, readiness, request correlation, and response watchdogs.
- `dom/runner.ts` owns each concrete iframe job: source checks, port transfer, timeout, and cleanup.
- `dom/frame.ts` contains the self-contained code serialized into the sandbox: fixture installation, dependency loading, and benchmark execution.
- `dom/protocol.ts` defines shared messages and checks output at the sandbox boundary. Trusted app messages use the shared TypeScript contract.
- `pages/runner.vue` owns the runner channel, one active-case map, and visible status. It ignores duplicate active request IDs and cancels all jobs on disposal.

### Why the inner iframe remains necessary

A separate same-origin top-level window is not a security sandbox. Running submitted code directly there would expose origin storage and potentially the application. The trusted window shell therefore evaluates no benchmark code. The inner frame omits `allow-same-origin`, `allow-popups`, and top-navigation permissions, giving user code DOM APIs while denying access to application storage and the shell's DOM.

This is isolation from application capabilities, not a CPU or memory boundary. An infinite synchronous loop can still hang the runner, and browsers do not guarantee a separate OS process. The parent timeout can mark the job failed; if the runner's event loop is permanently stuck, the user may still need to close that window manually.

## Architecture Decisions

- **One popup per run:** complies with popup-blocker expectations and avoids opening one window per case.
- **Open synchronously:** create the channel and call `window.open()` directly inside the Run click path, before compilation or any other `await`.
- **Use `noopener`:** user code must never receive an opener relationship. Because `noopener` makes the return value unusable, readiness over `BroadcastChannel` determines whether the window opened successfully.
- **Use a random channel name in the URL fragment:** the token is not sent to the server, and the runner clears it from the visible URL after joining. Messages use a small discriminated-union protocol with request IDs; the channel name scopes the session.
- **Transfer a `MessagePort` into each sandbox:** opaque-origin frames require `"*"` for the initial `postMessage`; the shell verifies `event.source`, sends the payload with a dedicated port, and receives the result over that port. The frame verifies its parent source before accepting the job.
- **Fresh visible frame per case:** matches the current “setup separately for each case” behavior, prevents DOM leakage between cases, and permits layout APIs. The frame must not use `display: none`.
- **Keep JavaScript and HTML setup separate:** install an optional HTML body fragment first, then load dependencies, then run the existing JavaScript setup to create `DATA`. Inline markup and styles work naturally; executable initialization and awaiting external assets belong in JavaScript setup.
- **Share the benchmark engine:** rename the worker-specific types/function to generic benchmark names, but do not change calibration, warmup, sampling, elapsed-time accounting, or statistics.
- **Load dependencies in declared order:** use script elements for classic dependencies and dynamic `import()` for ESM dependencies, exposing ESM namespaces on `globalThis` with the existing naming convention before setup runs.
- **Configurable DOM scheduling:** use `Promise.all` with one fresh frame per case when parallel execution is enabled, or run one frame/job at a time when it is disabled. Worker mode retains the same setting and behavior.
- **No focus stealing:** the runner opens on Run, but neither page repeatedly calls `focus()`. The user can return to the benchmark page while it runs.
- **Represent hidden execution as live state:** DOM mode receives `document.visibilityState` from its runner; Worker mode observes the benchmark page's own visibility. While the active execution document is hidden, keep one warning toast open with `duration: 0` and no progress timeout. Remove it when the DOM runner becomes visible or the run ends; recreate the same logical warning if it becomes hidden again. In Worker mode the page itself cannot display a visible warning while hidden, so retain it briefly after visibility returns before removing it. Use `visibilitychange`, not window blur, because loss of focus does not necessarily mean the document is hidden.

## Proposed Data and Message Contracts

Names may move to a nearby file if existing conventions require it, but the behavior and fields should remain stable.

```ts
export const BENCHMARK_RUNTIMES = {
  worker: { label: 'Worker' },
  dom: { label: 'DOM' },
} as const

export type BenchmarkRuntime = keyof typeof BENCHMARK_RUNTIMES

export type Config = {
  benchmarkMode: BenchmarkMode
  runtime: BenchmarkRuntime
  name: string
  parallel: boolean
  globalTestConfig: TestCase
  dataCode: string
  setupHtml: string
}

export type DomRunPayload = {
  caseName?: string
  dependencies: Dependency[]
  options: BenchmarkRunOptions
  setupHtml: string
}

export type SerializedBenchmarkError = {
  name: string
  message: string
  stack?: string
}
```

Use a fresh channel named like `jsbenchmark:dom:<random-session-id>` for each session. The channel name provides session isolation; only job/result/error messages carry a `requestId`. Visibility and closure describe the whole window.

```ts
type ParentToRunnerMessage =
  | {
      type: 'run'
      requestId: string
      responseTimeoutMs: number
      payload: DomRunPayload
    }
  | { type: 'close' }

type RunnerToParentMessage =
  | { type: 'ready' }
  | { type: 'result'; requestId: string; result: BenchmarkRunResult }
  | { type: 'error'; requestId: string; error: SerializedBenchmarkError }
  | { type: 'visibility'; hidden: boolean }
  | { type: 'closing' }
```

- Dispatch trusted parent/runner messages by type and resolve only outstanding request IDs. Normalize runtime and HTML fixture values when loading shared URLs. Check result/error shape once at the sandbox output boundary; app-generated payloads do not need repeated schema validation.
- Ignore stale, duplicate, or unrelated messages rather than mutating case state.
- Serialize errors explicitly instead of relying on browser-specific structured cloning of `Error`.
- The frame gets its one job and transferred `MessagePort` together in a source-checked bootstrap message. It returns exactly one result or error over that port, after which the shell closes the port and removes the frame.
- Generate session/request IDs with the already-installed `nanoid`. Its URL-safe tokens need no URI encoding in the session fragment.

### Why these communication pieces exist

These mechanisms solve different problems; they are not all separate security boundaries.

- **Sandboxed iframe and `noopener`: security boundary.** They keep benchmark code away from application DOM/storage and remove direct access to the originating page. These are essential.
- **BroadcastChannel: necessary transport.** With `noopener`, the parent does not retain a usable `WindowProxy`. A same-origin BroadcastChannel lets the trusted page and trusted runner shell communicate anyway.
- **Random session/channel ID: routing and isolation hygiene.** Multiple benchmark tabs or stale runner windows must not receive each other's jobs. The unguessable channel name scopes traffic to one run, so the session ID is not repeated inside messages.
- **Request ID: asynchronous correctness.** It prevents a late result from a timed-out/replaced frame resolving the next case and makes errors/results traceable to the correct test.
- **MessagePort: bounded frame channel and cleanup.** The sandbox has an opaque origin, so its bootstrap `postMessage` must use `"*"`. Transferring a port after verifying `event.source === iframe.contentWindow` avoids keeping a global `message` listener for all job traffic and gives each one-job frame an easy-to-close private channel. The actual security boundary remains the sandbox; a carefully source-checked `window.postMessage` protocol could work, but the port keeps the implementation less collision-prone.
- **No user-code interpolation: parser safety, ordering, and maintainability.** A snippet containing `</script>` can terminate an inline script while HTML is parsed, break the harness, or execute before dependencies/setup. Keeping the harness source trusted and sending user strings as structured data avoids context-sensitive escaping and makes execution order deterministic. It complements the sandbox rather than replacing it.

## HTML Fixture Contract

- `setupHtml` is an optional HTML **body fragment**, not a full document.
- The frame installs it with `document.body.innerHTML` before loading declared dependencies. This lets dependency initialization and JavaScript setup query the fixture.
- `<script>` elements supplied in the HTML fragment are not an executable setup mechanism and should remain inert under the chosen insertion method. Users put executable code in JavaScript setup or add a dependency URL.
- Inline `<style>` and ordinary markup are supported. External images/styles may begin loading, but the runner does not guess when arbitrary subresources are ready.
- JavaScript setup is already async-capable; users who require loaded images, fonts, or styles explicitly await them there before returning `DATA`.
- The same `setupHtml` is installed from scratch for each case. Worker mode preserves the value in shared config but ignores it.
- Missing or non-string `setupHtml` from an older/malformed URL normalizes to `''`.

Canonical smoke fixture:

```html
<button id="target">Toggle</button>
<style>
  #target[data-active] {
    width: 120px;
  }
</style>
```

```js
const element = document.querySelector('#target')
const image = new Image()
return { element, image }
```

```js
DATA.element.toggleAttribute('data-active')
```

The smoke result must have positive elapsed time/operations and must not leak the element into the next case's fresh document.

## UI Design

- Add Nuxt UI `UTabs` immediately beside the Run button group, with `Worker` and `DOM` items.
- Bind the tabs to a typed config value using `v-model`, stable item `value`s, and `:content="false"`; this uses the exact API exposed by installed Nuxt UI 4.11.1.
- Disable both tab items while any case is running so a result cannot change meaning midway through a run.
- Keep the current Setup presentation unchanged in Worker mode. In DOM mode, show a compact secondary tab list with `JavaScript` and `HTML fixture` panels so both inputs remain available without permanently lengthening the page.
- Extend `BaseCodeEditor` with a typed `javascript | html` language prop, add CodeMirror's HTML language package, hide the TypeScript toggle for HTML, and use an HTML-specific placeholder.
- Describe HTML as an optional body fragment inserted before JavaScript setup and excluded from timing. Do not imply that it is a complete document or a second executable setup language.
- Keep the parallel switch visible and enabled in DOM mode. Explain that sequential execution is more reliable and that parallel cases use separate frames but still contend for the runner's renderer, layout, and memory resources.
- Clear ephemeral results when the execution environment changes, preventing Worker results from being displayed under the DOM selection or vice versa.
- Disable all per-case Run buttons while a DOM job is active; Worker mode keeps its current ability to start independent cases.
- Update methodology and error copy so it describes the selected environment rather than always saying “worker.”
- The runner page has no normal application layout. Its branded status surface fills the viewport; each active sandbox remains a rendered, full-viewport iframe beneath that trusted surface so document layout is not constrained by the status UI.

### Canonical labels and copy

- Runtime tabs: `Worker` and `DOM`; accessible label: `Benchmark environment`.
- DOM runner details live in the info popover within the DOM tab; describe the separate window, fresh sandboxed frames, setup order, visibility caveat, and optional parallel scheduling there.
- Setup tabs: `JavaScript` and `HTML fixture`.
- HTML helper: `Optional body markup inserted before JavaScript setup. Setup is excluded from benchmark timing.`
- Visibility warning title: `Benchmark runner is hidden` (DOM) or `Benchmark page was hidden` (Worker after returning).
- Visibility warning description: `The browser may throttle timers and animation frames, which can make this run less reliable.`
- Readiness error: `The DOM runner did not open. Allow popups for this site and try again.`
- Runner idle/status instruction: `Keep this runner open while the benchmark is active. You can continue using the benchmark page.`

Copy can be tightened for layout, but it must preserve these meanings. Use Nuxt UI semantic colors and the existing toast conventions.

## Execution Lifecycle

1. The page snapshots the selected runtime and cases for the run.
2. For DOM mode, it creates a random session/channel ID and opens `/runner#<session>` synchronously with `noopener,popup` and a reasonable requested size.
3. The runner joins the same-origin channel, removes the fragment from its URL, and emits `ready`.
4. The parent compiles the case and setup code exactly as it does today, then sends the compiled code, settings, dependencies, case name, and request ID.
5. The runner creates a visible `sandbox="allow-scripts"` iframe and transfers a message port together with its job payload to the source-checked harness.
6. The frame installs `setupHtml` into its body, loads dependencies, runs JavaScript setup once, executes the existing benchmark function, and returns its raw measurement.
7. The runner removes each frame independently and relays its result/error. Sequential scheduling sends the next request afterward; parallel scheduling may keep several frames active. The parent summarizes every raw result with the existing statistics path.
8. On completion, the parent sends `close`; the runner closes its channel and calls `window.close()` on itself.
9. A readiness timeout produces a focused “runner did not open; allow popups and retry” error. A per-case timeout produces the current infinite-loop/long-running guidance. Timeouts clean parent-side listeners and channels even if a hung runner cannot close itself.
10. If the runner becomes hidden during active work, it reports that state to the parent. The parent keeps one persistent warning toast visible for the duration of the hidden state and removes it when visibility returns or the run ends. Further hidden transitions reuse the same logical warning rather than stacking toasts.
11. The runner reports user-initiated navigation or closure once from `pagehide` or `beforeunload`; the parent treats that as terminal and rejects every active request. The response watchdog remains the fallback for a hung or abruptly terminated context that cannot deliver a final message.

### State and failure rules

- Snapshot runtime and cases at the start of an action. Changing editors after Run does not mutate the in-flight payload.
- Open the DOM window before the first `await`; compilation happens after the ready handshake can begin.
- A 3-second ready timeout is sufficient for the focused implementation. Since `noopener` makes a successful `window.open()` return `null`, absence of `ready` is reported as the actionable popup/load failure above rather than attempting to distinguish every cause.
- Start the response watchdog when the `run` message is sent; dependency loading and JavaScript setup count against it, matching the practical Worker lifecycle. For parallel DOM Run-all, expand only that watchdog by the number of cases because synchronous frame jobs can queue on one renderer. Do not change the benchmark's own warmup or measurement budgets, and retain the original per-case duration in timeout guidance.
- Compilation or case failure marks only that case as `error`; Run all continues with the next case when the runner session remains usable.
- Failure to establish the runner marks every selected DOM case as failed and ends the run.
- A correlated `closing` message rejects all active requests immediately. If the runner disappears without sending it, the per-case timeout is the fallback.
- On normal completion or any parent-side terminal failure, close timers/listeners/channels in `finally`. Send `close` when the runner is still responsive.
- Runtime tabs and all DOM per-case Run controls are disabled while any DOM request is active. Worker controls keep their current concurrency behavior. The Run-all parallel setting is snapshotted before execution begins.
- Switching runtime while idle clears ephemeral `stateByTest` results but preserves benchmark source, HTML, dependencies, mode, and the saved Worker parallel preference.
- Maintain at most one visibility-warning toast at a time for a single-case or Run-all action. Keep it present while hidden, remove/re-show it as visibility changes, and never mark results failed solely because of visibility.

## Benchmarking Invariants

- Setup remains outside timed measurement and runs once per case.
- The optional HTML fixture is installed before dependency and JavaScript setup and remains outside timed measurement.
- `DATA` remains a frame-global value available to every invocation in that case.
- Batch calibration still targets `TARGET_BATCH_TIME` (currently 40 ms).
- Configured measurement/warmup budgets and final-batch overshoot remain unchanged.
- Async cases remain awaited once per operation.
- Raw results continue through `summarizeBenchmark`; exports and statistics consume the same result shape.
- A “DOM-only yield” would mean pausing after a completed measured batch—outside its timer—so the event loop can process rendering, messages, visibility changes, and watchdog callbacks before the next batch. It is not added initially because it would give DOM mode different scheduling, allow more layout/GC work between samples, and can greatly extend wall-clock duration when background tasks are throttled. Runtime QA must check the main page for long tasks; add time-sliced DOM passes only if the isolated window still causes measurable stalls.
- Results should only be compared among cases from the same environment and run. Background/minimized execution can affect DOM timers, animation frames, network callbacks, and browser scheduling.

## Implementation Guardrails

- Do not execute user-authored code or HTML in the trusted runner page's global context.
- Do not add `allow-same-origin`, `allow-popups`, `allow-top-navigation`, `allow-forms`, or `allow-downloads` to the sandbox.
- Do not interpolate user strings into a `<script>` or the generated `srcdoc`; send them after readiness as structured data alongside the transferred port.
- Do not reuse an iframe between cases, even if reuse looks faster.
- Keep DOM parallelism behind the existing switch and in the same runner window; do not open a popup per case or relax frame isolation.
- Do not compare Worker and DOM results or silently carry displayed results across a runtime change.
- Do not refactor the REPL or unrelated UI while touching shared Worker utilities.
- Avoid a second benchmark implementation. Both environments must call the same self-contained engine and the same summarizer.
- Do not add a new test framework solely for this feature. Unit-test pure protocol/session logic with faked browser primitives and perform the sandbox/popup assertions in the required real-browser checkpoint.

## Task List

### Phase 1: Preserve and generalize the benchmark contract

- [ ] Task 1: Make the benchmark engine runtime-neutral and add a typed runtime resolver.

### Checkpoint: Benchmark foundation

- [ ] Existing numerical/timing tests pass without changed expectations.
- [ ] Older or malformed shared config resolves to Worker mode.

### Phase 2: Build the isolated DOM execution path

- [ ] Task 2: Define and test the window/frame protocol and sandbox harness.
- [ ] Task 3: Build the trusted runner page and parent window session controller.

### Checkpoint: Isolated runner

- [ ] A direct DOM smoke case using `document`, element insertion, and `new Image()` succeeds in a real browser.
- [ ] An HTML fixture is available to JavaScript setup and test code, and each case receives a fresh copy.
- [ ] The benchmark page remains interactive during a normal synchronous DOM run.
- [ ] Sandbox code cannot read the runner shell DOM or origin storage and cannot navigate/open another top-level window.

### Phase 3: Integrate the runtime into benchmark orchestration and UI

- [ ] Task 4: Route single/all runs through the selected executor and preserve Worker parallelism.
- [ ] Task 5: Add the Nuxt UI runtime/setup tabs, HTML editor support, and environment-aware guidance.

### Checkpoint: Complete

- [ ] Focused and full tests pass.
- [ ] Typecheck and production build pass.
- [ ] Worker and DOM manual scenarios pass in current Chromium and Firefox; Safari receives a focused smoke check if available.
- [ ] The recent adaptive color-theme behavior remains intact.
- [ ] Human review approves behavior and copy before merge.

## Risks and Mitigations

| Risk                                          | Impact                                                       | Mitigation                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Popup is blocked or opened as a tab           | DOM run cannot start or differs visually                     | Open once and synchronously; use a ready timeout and actionable error; do not depend on a window handle or exact chrome.             |
| Same-origin popup exposes the app             | User code could access storage/page state                    | Keep all user code in an `allow-scripts`-only sandboxed iframe; open the trusted shell with `noopener`.                              |
| Infinite synchronous user code                | Runner may remain hung after parent timeout                  | Mark the case failed in the parent, clean communication resources, show manual-close guidance; hard termination is not promised.     |
| Background throttling changes results         | Timer/rAF/async measurements become misleading               | Allow background use but explain the limitation in methodology; do not market this mode as process-isolated or background-invariant. |
| Visibility warning becomes noisy              | Repeated window switching obscures more important status     | Model visibility as one add/remove toast state; never stack a new toast for each event.                                              |
| DOM state leaks across cases                  | Later cases receive an unfair advantage or corrupted fixture | Create and destroy a new iframe for every case, including concurrent cases; never reuse documents.                                   |
| Parallel DOM cases contend for one renderer   | Results can reflect layout, memory, or renderer contention   | Keep sequential execution available and explain the tradeoff next to the setting and in the runner popover.                          |
| Parallel synchronous DOM cases queue          | Later cases can exceed a normal per-case response deadline   | Scale only the parallel response watchdog by case count; keep measurement budgets and sequential/Worker deadlines unchanged.         |
| Dependency behavior diverges from Worker mode | Existing shared benchmarks fail in DOM mode                  | Preserve dependency order and global naming; test one classic and one ESM dependency in-browser.                                     |
| Opaque origin changes APIs                    | Storage and credentialed/CORS-dependent code fails           | Treat this as intentional isolation; document that DOM APIs are supported, not same-origin application privileges.                   |
| Recent UI work overlaps `index.vue`           | The DOM controls regress adaptive theming                    | Build on commit `30cd3b1`, use Nuxt UI semantic colors, and review the final diff against `HEAD`.                                    |

## Explicit Non-goals

- Multiple popup windows for one Run-all action.
- Guaranteed renderer/OS-process isolation.
- Force-closing a permanently hung opener-isolated window.
- Cookies, `localStorage`, IndexedDB, same-origin application DOM, or privileged browser APIs inside the benchmark frame.
- Accurate foreground animation/paint benchmarking while the runner is hidden or minimized.
- Full-document HTML, teardown hooks, or configurable viewport presets; the supported HTML input is an optional body fragment.
- Migrating the REPL to the new runner.

## Sources

- Nuxt UI Tabs API: https://ui.nuxt.com/docs/components/tabs and the installed `@nuxt/ui` 4.11.1 `Tabs.vue.d.ts` (`v-model`, item `value`, and `content: false`).
- CodeMirror HTML language support: https://codemirror.net/docs/ref/#lang-html
- `window.open()` popup/user-activation and `noopener` behavior: https://developer.mozilla.org/en-US/docs/Web/API/Window/open
- BroadcastChannel same-origin cross-context communication: https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API
- Iframe sandbox behavior and the danger of combining `allow-scripts` with `allow-same-origin`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe
- Background visibility and timer/rAF throttling: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- Current jsPerf's separate Prep HTML and Setup JS precedent: https://github.com/mr47/jsperf.app/blob/main/components/forms/Edit.tsx#L451-L503

## Open Questions

No blocking product decision remains for the focused first version. If implementation QA shows meaningful main-page stalls despite the opener-isolated window, pause before changing timing behavior and choose explicitly between a DOM-only yield between measured batches or deployment of the runner shell on a dedicated origin.
