import { expect, test } from '@playwright/test'

type ReplRuntime = 'worker' | 'dom'

const replUrl = ({
  code,
  name,
  runtime = 'worker',
  setupHtml = '',
}: {
  code: string
  name: string
  runtime?: ReplRuntime
  setupHtml?: string
}) => {
  const state = Buffer.from(
    JSON.stringify({
      config: {
        name,
        runtime,
        setupHtml,
        test: { id: 'repl', code, dependencies: [] },
      },
    })
  ).toString('base64url')

  return `/repl#${state}`
}

test('runs the default Worker example with console output and timings', async ({ page }) => {
  await page.goto('/repl')
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Basic example')
  await expect(page.getByRole('textbox', { name: 'REPL JavaScript' })).toContainText(
    "console.log('Hello World!'"
  )

  await page.getByRole('button', { name: 'Run', exact: true }).click()

  await expect(page.getByText('Complete')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByLabel('Result')).toHaveText('{ value: 42 }')
  await expect(page.getByRole('list', { name: 'Console output' })).toContainText('Hello World!')

  await page.getByRole('tab', { name: 'Timings' }).click()
  await expect(page.getByText('Wait', { exact: true })).toBeVisible()
})

test('runs DOM code against its HTML fixture and renders the preview', async ({ page }) => {
  await page.goto(
    replUrl({
      name: 'DOM E2E',
      runtime: 'dom',
      setupHtml: '<button id="target">initial</button>',
      code: `const target = document.getElementById('target')
target.textContent = 'updated'
return target.textContent`,
    })
  )
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('DOM E2E')

  await page.getByRole('button', { name: 'Run', exact: true }).click()

  await expect(page.getByText('Complete')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByLabel('Result')).toHaveText('updated')
  await expect(
    page.frameLocator('iframe[title="REPL DOM preview"]').getByRole('button', { name: 'updated' })
  ).toBeVisible()
})

test('recovers from an execution error and preserves edits after reload', async ({ page }) => {
  await page.goto(replUrl({ name: 'Broken E2E', code: `throw new Error('E2E failure')` }))
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Broken E2E')

  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByText('Execution failed')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('E2E failure', { exact: true })).toBeVisible()

  const originalUrl = page.url()
  await page.getByRole('textbox', { name: 'REPL JavaScript' }).fill('return 42')
  await page.getByRole('textbox', { name: 'Name' }).fill('Recovered E2E')
  await page.waitForURL((url) => url.href !== originalUrl)
  const nameUpdateUrl = page.url()
  await page.waitForURL((url) => url.href !== nameUpdateUrl)

  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByText('Complete')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByLabel('Result')).toHaveText('42')

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Recovered E2E')
  await expect(page.getByRole('textbox', { name: 'REPL JavaScript' })).toHaveText('return 42')
})
