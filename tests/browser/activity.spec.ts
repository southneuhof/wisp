import { expect, test } from '@playwright/test'

test('shows reasoning, tool details, an approval, and a file review in the thread', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?framework=vue&activity')
  await page.getByRole('button', { name: 'Open chat', exact: true }).click()

  await expect(page.locator('.wisp-assistant-message')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  )
  await page.locator('summary').filter({ hasText: 'Reasoning' }).click()
  await expect(
    page.getByText('I will read the current notes first.'),
  ).toBeVisible()
  await page
    .locator('summary')
    .filter({ hasText: 'Find the checklist' })
    .click()
  await expect(
    page.getByText('Found the launch checklist in the Product team.'),
  ).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .locator('.wisp-assistant-message')
      .getByRole('button', { name: 'Download Launch brief.md' })
      .click(),
  ])
  expect(download.suggestedFilename()).toBe('Launch brief.md')

  const approval = page.getByRole('region', { name: 'Create the issue' })
  await expect(approval.getByText('Review the launch checklist')).toBeVisible()

  const changes = page.getByRole('region', { name: 'Pending changes' })
  await expect(changes).toBeVisible()
  const diff = changes.getByRole('group', { name: 'Changes to README.md' })
  await expect(diff).toBeVisible()
  const split = diff.locator('[data-diff-type="split"][data-overflow="wrap"]')
  await expect(
    split
      .locator('[data-deletions] [data-line]')
      .getByText('Install dependencies.'),
  ).toBeVisible()
  await expect(
    split
      .locator('[data-additions] [data-line]')
      .getByText('Run pnpm install, then pnpm dev.'),
  ).toBeVisible()

  await approval.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(
    approval.getByRole('button', { name: 'Approve', exact: true }),
  ).toHaveCount(0)
  await changes.getByRole('button', { name: 'Accept changes' }).click()
  await expect(changes).toHaveCount(0)
  expect(errors).toEqual([])
})

test('reviews MCP arguments without exposing the private endpoint and links to CloudflareOS after a failed approval', async ({
  page,
}) => {
  await page.goto('/?framework=vue&activity&mcp')
  await page.getByRole('button', { name: 'Open chat', exact: true }).click()
  const approval = page.getByRole('region', { name: 'Create piece draft' })
  await expect(
    approval.getByText('Sustainability', { exact: true }),
  ).toBeVisible()
  await expect(approval.getByText('en', { exact: true })).toBeVisible()
  await expect(
    approval.getByText('editorial_create_piece_draft', { exact: true }),
  ).toBeHidden()
  const details = approval
    .locator('summary')
    .filter({ hasText: 'Tool details' })
  await details.click()
  await expect(
    approval.getByText('https://editorial.example', { exact: true }),
  ).toBeVisible()
  await expect(approval).not.toContainText('private-token')
  await details.click()
  await approval.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(approval.getByRole('alert')).toContainText('couldn’t confirm')
  await expect(
    approval.getByRole('link', { name: 'Open CloudflareOS' }),
  ).toHaveAttribute('href', /workspace\/a\?chat=1/)
})
