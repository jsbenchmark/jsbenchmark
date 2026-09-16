import { expect, test } from '@playwright/test'

const benchmarkUrl = (runtime: 'worker' | 'dom') => {
  const config = {
    benchmarkMode: 'quick',
    runtime,
    name: `${runtime.toUpperCase()} E2E`,
    parallel: false,
    dataCode: runtime === 'dom' ? "return { id: 'target' }" : 'return 41',
    setupHtml: runtime === 'dom' ? '<button id="target">Target</button>' : '',
    globalTestConfig: { id: 'setup', code: '', dependencies: [] },
  }
  const cases = [
    {
      id: 'e2e-case',
      name: runtime === 'dom' ? 'DOM lookup' : 'Worker addition',
      code: runtime === 'dom' ? 'document.getElementById(DATA.id)' : 'DATA + 1',
      dependencies: [],
    },
  ]
  const state = Buffer.from(JSON.stringify({ config, cases })).toString('base64url')

  return `/#${state}`
}

test('runs a benchmark in a Web Worker', async ({ page }) => {
  await page.goto(benchmarkUrl('worker'))
  await expect(page.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('WORKER E2E')

  await page.getByRole('button', { name: 'Run all' }).click()

  await expect(page.getByText(/^Ops\/s: [\d,.]+$/).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled()
  await expect(page.getByRole('alert', { name: 'Error' })).toHaveCount(0)
})

test('runs a DOM benchmark through the popup runner', async ({ context, page }) => {
  await page.goto(benchmarkUrl('dom'))
  await expect(page.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('DOM E2E')

  const runnerPromise = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Run all' }).click()
  const runner = await runnerPromise

  await expect(runner.getByRole('heading', { name: 'DOM benchmark runner' })).toBeVisible()
  await expect(page.getByText(/^Ops\/s: [\d,.]+$/).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('alert', { name: 'Error' })).toHaveCount(0)
})
