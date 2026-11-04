import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
const selectors = [
  '.wisp-header',
  '.wisp-composer',
  '.wisp-thread-fade',
  '.wisp-markdown',
]
async function layout(page: Page) {
  return page.locator(selectors.join(',')).evaluateAll((nodes) =>
    nodes.map((n) => {
      const box = n.getBoundingClientRect(),
        s = getComputedStyle(n)
      return {
        selector: n.classList[0],
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        font: s.fontSize,
        color: s.color,
      }
    }),
  )
}
test('Vue and React retain the same conversation geometry and styles', async ({
  page,
}, info) => {
  const frames = []
  for (const framework of ['vue', 'react']) {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/?framework=' + framework)
    await page.getByRole('button', { name: 'Open chat', exact: true }).click()
    await expect(page.locator('.wisp-composer')).toBeVisible()
    await page.waitForTimeout(400)
    frames.push(await layout(page))
    await info.attach(framework + '-chat', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    expect(errors).toEqual([])
  }
  expect(frames[1]?.length).toBe(frames[0]?.length)
  for (let i = 0; i < frames[0]!.length; i++) {
    const a = frames[0]![i]!,
      b = frames[1]![i]!
    expect(b.selector).toBe(a.selector)
    expect(b.font).toBe(a.font)
    expect(b.color).toBe(a.color)
    for (const key of ['x', 'y', 'width', 'height'] as const)
      expect(
        Math.abs(a[key] - b[key]),
        `${a.selector} ${key}`,
      ).toBeLessThanOrEqual(1.1)
  }
})
test('React menus preserve the panel, apply opaque theme colors, and keep create workspace open', async ({
  page,
}) => {
  await page.goto('/?framework=react')
  await page.getByRole('button', { name: 'Open chat', exact: true }).click()
  await page.getByRole('button', { name: 'Chat settings' }).click()
  await page.getByRole('menuitem', { name: 'Workspace A', exact: true }).hover()
  await page
    .getByRole('menuitem', { name: 'Create workspace', exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: 'Workspace name' }),
  ).toBeFocused()
  await expect(page.getByRole('button', { name: 'Close chat' })).toBeVisible()
  const colors = await page
    .locator('.wisp-menu-content')
    .evaluateAll((nodes) =>
      nodes.map((n) => getComputedStyle(n).backgroundColor),
    )
  expect(colors.length).toBeGreaterThan(0)
  expect(
    colors.every(
      (c) => c === 'rgb(255, 255, 255)' || c === 'color(srgb 1 1 1)',
    ),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Model', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Model Two' }).click()
  await expect(
    page.getByRole('button', { name: 'Model', exact: true }),
  ).toContainText('Model Two')
  await expect(page.getByRole('button', { name: 'Close chat' })).toBeVisible()
})
test('sign-in remains a stage with matching Vue and React dimensions', async ({
  page,
}, info) => {
  const boxes = []
  for (const framework of ['vue', 'react']) {
    await page.goto('/?framework=' + framework + '&signedOut')
    await page.getByRole('button', { name: 'Open chat', exact: true }).click()
    await page.waitForTimeout(400)
    await expect(
      page.getByRole('button', { name: 'Select conversation' }),
    ).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible()
    boxes.push(
      await page.getByRole('textbox', { name: 'Username' }).boundingBox(),
    )
    await info.attach(framework + '-signin', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  }
  expect(boxes[1]).toEqual(boxes[0])
})

test('long conversation and workspace menus keep their footer visible', async ({
  page,
}) => {
  await page.goto('/?framework=react&many')
  await page.getByRole('button', { name: 'Open chat', exact: true }).click()
  await page.getByRole('button', { name: 'Select conversation' }).click()
  const fresh = page.getByRole('menuitem', {
    name: 'New conversation',
    exact: true,
  })
  await expect(fresh).toBeInViewport()
  expect(
    await page
      .locator('.wisp-menu-list')
      .evaluate((n) => n.scrollHeight > n.clientHeight),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Chat settings' }).click()
  await page.getByRole('menuitem', { name: 'Workspace A', exact: true }).hover()
  await expect(
    page.getByRole('menuitem', { name: 'Create workspace', exact: true }),
  ).toBeInViewport()
  expect(
    await page
      .locator('.wisp-workspace-menu .wisp-menu-list')
      .evaluate((n) => n.scrollHeight > n.clientHeight),
  ).toBe(true)
})
test('composer blur and zoom animate through close and open', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/?framework=react')
  await page.getByRole('button', { name: 'Open chat', exact: true }).click()
  await expect(page.locator('.wisp-composer')).toHaveClass(
    /wisp-foreground-enter/,
  )
  const timing = await page
    .locator('.wisp-composer')
    .evaluate((n) => getComputedStyle(n).transitionDuration)
  expect(timing).toContain('0.28s')
  await page.waitForTimeout(400)
  await expect(page.locator('.wisp-composer')).not.toHaveClass(
    /wisp-foreground-enter-active/,
  )
  await page.getByRole('button', { name: 'Close chat' }).click()
  await expect(page.locator('.wisp-composer')).toHaveClass(
    /wisp-foreground-leave-to/,
  )
  await expect(page.locator('.wisp-composer')).toHaveCount(0)
})

test('CloudflareOS menu row matches Vue icon and label spacing', async ({
  page,
}) => {
  const offsets = []
  for (const framework of ['vue', 'react']) {
    await page.goto('/?framework=' + framework)
    await page.getByRole('button', { name: 'Open chat', exact: true }).click()
    await page.getByRole('button', { name: 'Chat settings' }).click()
    const item = page.getByRole('menuitem', {
      name: 'Open CloudflareOS',
      exact: true,
    })
    await expect(item).toBeVisible()
    await page.waitForTimeout(200)
    offsets.push(
      await item.evaluate((n) => {
        const icon = n.querySelector('svg')
        if (!icon) throw new Error('Missing icon')
        const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT)
        let text: Node | null
        while ((text = walker.nextNode())) {
          if (text.textContent?.includes('Open CloudflareOS')) {
            const range = document.createRange()
            range.selectNodeContents(text)
            return (
              range.getBoundingClientRect().left -
              icon.getBoundingClientRect().right
            )
          }
        }
        throw new Error('Missing menu label')
      }),
    )
  }
  expect(Math.abs(offsets[0]! - offsets[1]!)).toBeLessThanOrEqual(0.5)
  expect(offsets[1]).toBeLessThan(10)
})
