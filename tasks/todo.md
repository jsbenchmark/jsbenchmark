# Separate-Window DOM Benchmark Runner Tasks

Implementation intent, contracts, canonical copy, guardrails, and smoke fixtures live in `tasks/plan.md`. Read its “Agent Handoff: Start Here” section and current repository state before starting. Tasks are sequential unless a dependency explicitly says otherwise.

## Simplification pass (2026-09-16)

The complete DOM-runner implementation is preserved in baseline commit `87fcd9b`.

- Removed repeated payload validation and redundant message session IDs. Fresh channels still isolate sessions, and request IDs correlate results.
- Combined the iframe job payload and port transfer. Sandbox output is checked once before forwarding.
- Replaced the generic coordinator with concrete iframe jobs and one active-case map. Frame jobs own messaging, timeouts, and cleanup; the page owns session messages and status.
- Removed the parallel-capability wrapper, unused editor-language reconfiguration, and generic starter dependency comparison.
- Simplified session bookkeeping, shared timeout error construction, and reviewed spacing and module ownership for readability.
- Verification: 86 tests pass, including real channel isolation, real MessagePort responses, frame cleanup, and serialized harness execution in a fresh JavaScript context. Typechecking, formatting, production build, and diff checks pass. The build retains the existing large-chunk warning. No additional browser automation was run.

## Task 1: Generalize the benchmark contract and runtime configuration

**Progress:** Complete — baseline verified; runtime-neutral engine and config normalization implemented.

**Description:** Rename the worker-specific benchmark function/types to runtime-neutral names without changing measurement behavior. Add a small runtime definition/resolver, store the selected runtime in `Config`, and add an optional `setupHtml` value that defaults safely for older URLs.

**Acceptance criteria:**

- [x] Worker execution produces the same raw results and retains the self-serialization guarantee.
- [x] `worker` and `dom` are the only accepted runtime values; absent, inherited-key, and malformed values resolve to `worker`.
- [x] Clear/default config and shared-URL hydration use the resolver consistently, with missing or malformed `setupHtml` normalized to an empty string.

**Verification:**

- [x] Tests pass: `pnpm test tests/benchmark/run.test.ts tests/benchmark/runtimes.test.ts` (8 tests passed).
- [x] Typecheck passes: `pnpm typecheck`.
- [x] Review confirms no timing constants, loop bounds, or statistics calculations changed.

**Dependencies:** None

**Files likely touched:**

- `app/utils/benchmark/run.ts`
- `app/utils/benchmark/runtimes.ts`
- `app/types/index.ts`
- `tests/benchmark/run.test.ts`
- `tests/benchmark/runtimes.test.ts`

**Estimated scope:** Medium (5 files)

## Task 2: Define the DOM protocol and sandbox-frame harness

**Progress:** Complete — protocol and serializable frame harness implemented and browser-smoked.

**Description:** Add typed, discriminated messages for parent/window/frame communication and a serializable iframe harness. The harness installs an optional HTML body fragment, loads classic and ESM dependencies in order, exposes named ESM imports, runs JavaScript setup and the shared benchmark function, and serializes errors consistently.

**Acceptance criteria:**

- [x] Fresh channels isolate sessions, request IDs correlate jobs, and sandbox responses are checked before forwarding.
- [x] The harness accepts one payload together with its transferred `MessagePort` after verifying its parent source.
- [x] `setupHtml` is installed before dependencies and JavaScript setup, is excluded from measurement, and is recreated for every case.
- [x] Classic and ESM load failures, setup failures, synchronous failures, and async failures return useful error messages.

**Verification:**

- [x] Tests pass: `pnpm test tests/benchmark/dom-protocol.test.ts tests/benchmark/dom-frame.test.ts` (11 tests passed, including direct parent-source/one-port bootstrap coverage).
- [x] Typecheck passes: `pnpm typecheck`.
- [x] Manual harness smoke check confirms `document.createElement`, DOM insertion, and `new Image()` are available in Chromium 153 and Firefox 155.

**Dependencies:** Task 1

**Files likely touched:**

- `app/utils/benchmark/dom/protocol.ts`
- `app/utils/benchmark/dom/frame.ts`
- `tests/benchmark/dom-protocol.test.ts`
- `tests/benchmark/dom-frame.test.ts`

**Estimated scope:** Medium (4 files)

## Task 3: Build the runner window and parent session controller

**Progress:** Complete — session lifecycle, timeout cleanup, blocked-popup handling, sandbox restrictions, and visibility warning behavior verified.

**Description:** Add a minimal, layout-free Nuxt runner page and a parent-side controller. The controller opens one `noopener` runner synchronously, waits for its BroadcastChannel handshake, sends correlated jobs, enforces readiness/per-case timeouts, relays visibility state, and closes all communication resources. The runner creates a fresh visible `allow-scripts`-only iframe for each job, supports multiple active frames when parallel execution is selected, and never evaluates user code in its own global scope.

**Acceptance criteria:**

- [x] One runner opens for a session, sends `ready`, streams correlated results/errors, and closes itself after completion; page-level single/Run-all wiring is Task 4.
- [x] Missing/blocked runner and timed-out case paths reject predictably and clean resources; the parent shows one persistent visibility warning while the runner is hidden.
- [x] The frame has no `allow-same-origin`, popup, navigation, form, download, or storage permission and is removed after every case.

**Verification:**

- [x] Tests pass: `pnpm test tests/benchmark/dom-session.test.ts` (9 tests passed, including terminal close and parent-watchdog paths).
- [x] Typecheck passes: `pnpm typecheck`.
- [x] Browser check: simulated blocked popups produce the actionable error; normal DOM Run all opens exactly one runner in Chromium 153 and Firefox 155.
- [x] Manual check: attempt `localStorage`, parent DOM access, top navigation, and `window.open()` from benchmark code and confirm sandbox restrictions hold in Chromium 153 and Firefox 155.
- [x] Browser check: repeated runner `visibilitychange` events show one persistent warning while hidden, remove it while visible, recreate it without duplicates, and clean it after the run.

**Dependencies:** Task 2

**Files likely touched:**

- `app/utils/benchmark/dom/session.ts`
- `app/pages/runner.vue`
- `app/utils/benchmark/dom/protocol.ts`
- `tests/benchmark/dom-session.test.ts`

**Estimated scope:** Medium (4 files)

## Checkpoint: Isolated DOM execution

- [x] Tasks 1-3 focused tests pass (28 tests passed).
- [x] `pnpm typecheck` passes.
- [x] Real-browser DOM cases receive statistically valid positive results through the existing summary path.
- [x] Main benchmark page controls remain usable during an Extended synchronous DOM run while execution/runtime-changing controls remain locked.
- [x] Architecture reviewed before and after integration; the independent final review's required lifecycle, timeout, state-ownership, and module-boundary findings were fixed and regression-tested.

## Task 4: Integrate runtime-aware execution orchestration

**Progress:** Complete — runtime-neutral preparation and result handling live in an execution composable; scheduling and browser behavior are verified.

**Description:** Refactor the benchmark page's case execution just enough to share compilation, state transitions, error normalization, and result summarization while selecting either one-shot workers or a DOM window session. Preserve Worker parallel runs, use sequential DOM scheduling when parallel is disabled, and keep concurrent DOM cases in independent frames inside the same runner window.

**Acceptance criteria:**

- [x] Worker single/all behavior and optional parallelism remain unchanged.
- [x] DOM Run all uses one session and gives every case a fresh frame and setup value; cases execute in displayed order when parallel is disabled and may execute concurrently when it is enabled.
- [x] Compilation, dependency, timeout, and benchmark errors update the correct case without leaving the page or session stuck in running state.

**Verification:**

- [x] Tests pass: `pnpm test tests/benchmark/execution.test.ts tests/benchmark/run-status.test.ts tests/benchmark/use-benchmark-execution.test.ts` (12 tests passed).
- [x] Full tests pass: `pnpm test` (15 files, 70 tests).
- [x] Browser check: two DOM cases mutate/read document state and confirm no state leaks between fresh frames.
- [x] Browser check: Worker Run all succeeds in Chromium and Firefox; Chromium timing confirms saved parallel execution remains observably faster than sequential execution (1.39 s vs 2.60 s in the final smoke).

**Dependencies:** Task 3

**Files likely touched:**

- `app/pages/index.vue`
- `app/composables/benchmark-execution.ts`
- `app/composables/benchmark-run-status.ts`
- `tests/benchmark/execution.test.ts`
- `tests/benchmark/run-status.test.ts`

**Estimated scope:** Medium (5 files)

## Task 5: Add the runtime/setup tabs and HTML editor support

**Progress:** Complete — runtime and setup tabs, HTML CodeMirror support, runtime-aware controls/copy, and responsive behavior implemented.

**Description:** Place `UTabs` with `Worker` and `DOM` beside the Run button as the requested radio-style selector. In DOM mode, present the existing JavaScript setup and a new optional HTML fixture as secondary Setup tabs. Add HTML language support to the shared CodeMirror component, then make parallel settings, stale results, per-case controls, methodology, errors, and visibility-warning state runtime-aware for both environments.

**Acceptance criteria:**

- [x] Runtime tabs use installed Nuxt UI 4.11.1's controlled `v-model`, stable values, and `content=false`; they are keyboard operable and cannot change during a run.
- [x] Worker mode retains the current JavaScript setup UI; DOM mode offers separate `JavaScript` and syntax-highlighted `HTML fixture` panels, preserves both values, hides the TypeScript control for HTML, and explains execution order/timing.
- [x] DOM selection explains the separate runner in an info popover, keeps the parallel switch available with contention guidance, prevents concurrent per-case windows, and cannot display stale Worker results as DOM results.

**Verification:**

- [x] Typecheck passes: `pnpm typecheck`.
- [x] Production build passes: `pnpm build` (existing large-chunk warning remains).
- [x] Full tests pass: `pnpm test` (15 files, 70 tests).
- [x] Browser responsive check passes at 320, 375, 768, 1024, and 1440 px widths.
- [x] Browser setup check confirms switching setup tabs preserves both editors and the HTML fixture is queryable from JavaScript setup and benchmark code.
- [x] Browser keyboard check confirms runtime tab selection, Enter-activated Run, popup lifecycle, and continued main-page interaction without a focus trap.

**Dependencies:** Task 4

**Files likely touched:**

- `app/pages/index.vue`
- `app/components/TestCases.vue`
- `app/components/BaseCodeEditor.vue`
- `package.json`
- `pnpm-lock.yaml`

**Estimated scope:** Medium (5 files)

## Checkpoint: Complete

- [x] All task acceptance criteria are met.
- [x] `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.
- [x] Real-browser Worker and DOM smoke checks pass in Chromium 153 and Firefox 155.
- [x] Classic dependency, ESM dependency, synchronous case, asynchronous case, JavaScript setup, HTML fixture, `document`, and `new Image()` scenarios pass.
- [ ] True OS-level backgrounding without minimizing could not be automated: Playwright reported every separate top-level window as visible on this macOS host. Browser-driven hidden/visible transitions and the real `visibilitychange` handler pass; the documented throttling caveat remains intentionally conservative.
- [x] The implementation builds on commit `30cd3b1` without regressing its adaptive color-theme behavior (verified with forced dark color scheme).
- [ ] User reviews and approves the implementation before merge.

**Additional verification notes:** Safari 26.6.2 is installed, but `safaridriver` is disabled on this host, so the focused Safari smoke could not run without changing OS configuration. `pnpm audit --audit-level high` passes; the full audit reports one pre-existing low-severity transitive development-server issue through Nuxt Fonts/esbuild.

**Follow-up UI polish:** The DOM explanation now lives in a dedicated info popover inside the runtime selector, both setup tabs/helpers/editors remain mounted in overlapping grid tracks to reserve identical layout space, and the full-height runner status presentation is larger and centered. An untouched starter swaps to a DOM element-selection example on entering DOM mode and back to the Worker starter on return; custom benchmarks are preserved. Four focused example-selection tests, the 70-test full suite, `pnpm typecheck`, and `pnpm build` pass. A browser baseline reproduced the original 20 px setup-editor shift; the user then explicitly asked to stop browser verification, so the final source changes were not browser-smoked again.

**Follow-up DOM parallelism and runner layout:** DOM mode now honors the saved parallel setting. Concurrent requests remain correlated by request ID and render in fresh independent sandbox frames inside the single runner window; sequential remains available for lower-contention comparisons. Because synchronous frame jobs may queue on one renderer, parallel Run-all expands only its response watchdog by the case count while preserving every case's measurement budget and timeout guidance. The runner uses the existing logo and a responsive status surface that fills the viewport, with full-size rendered benchmark frames beneath it. A focused runner coordinator owns concurrent append/cleanup and is tested for out-of-order completion, cancellation, duplicate requests, and idempotent `pagehide`/`beforeunload` close reporting. Restoring a stable scoped style module also prevents the dev server's stale runner-style HMR request from parsing the SFC script as CSS. Final verification: `pnpm test` (16 files, 77 tests), `pnpm typecheck`, `pnpm build` (existing large-chunk warning only), and `git diff --check` pass. Per the user's instruction, this follow-up uses automated/static verification only—not additional browser automation.
