import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
const selectors = ['.wisp-header', '.wisp-composer']
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
test('Vue and React retain matching header and composer styles', async ({
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
      if (a.selector !== 'wisp-header' || key !== 'y')
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
for (const framework of ['vue', 'react']) {
  test(`${framework} morphs the launcher into the composer and back`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(`/?framework=${framework}`)
    const launcher = page.getByRole('button', {
      name: 'Open chat',
      exact: true,
    })
    const composer = page.locator('.wisp-composer')
    const start = await launcher.boundingBox()
    if (!start) throw new Error('Expected a visible launcher')

    const readMorph = (pauseAtMiddle = false) =>
      page.evaluate((pauseAtMiddle) => {
        return new Promise<{
          from: number
          middle: number
          to: number
          height: number
          landingRadius: number
          beforeLanding: number
          headerTop: number | undefined
          reveal:
            | {
                blur: string
                clip: string
                visible: boolean
                outsideHit: boolean
              }
            | undefined
        }>((resolve) => {
          const observer = new MutationObserver(() => {
            const shell =
              document.querySelector<HTMLElement>('.wisp-chat-morph')
            const motion = shell?.getAnimations()[0]
            if (!shell || !motion) return
            observer.disconnect()
            motion.pause()
            motion.currentTime = 0
            const from = shell.getBoundingClientRect().width
            const headerTop = document
              .querySelector('.wisp-header')
              ?.getBoundingClientRect().top
            const timing = motion.effect?.getTiming()
            const endTime = (timing?.delay ?? 0) + Number(timing?.duration)
            motion.currentTime = endTime * 0.45
            const middle = shell.getBoundingClientRect().width
            const content = shell.nextElementSibling
            let reveal
            if (
              content &&
              shell.parentElement?.classList.contains('wisp-composer')
            ) {
              const revealTime =
                Number(motion.effect?.getTiming().duration) * 0.4
              motion.currentTime = revealTime
              for (const animation of content.getAnimations()) {
                animation.pause()
                animation.currentTime = revealTime
              }
              const style = getComputedStyle(content)
              const shape = shell.getBoundingClientRect()
              const contentBounds = content.getBoundingClientRect()
              const x = (contentBounds.left + shape.left) / 2
              const y = (shape.top + shape.bottom) / 2
              reveal = {
                blur: style.filter,
                clip: style.clipPath,
                visible: Number(style.opacity) > 0,
                outsideHit: content.contains(document.elementFromPoint(x, y)),
              }
            }
            motion.currentTime = endTime * 0.98
            const beforeLanding = shell.getBoundingClientRect().width
            motion.currentTime = endTime
            const { width: to, height } = shell.getBoundingClientRect()
            const landingRadius = parseFloat(
              getComputedStyle(shell).borderTopLeftRadius,
            )
            if (pauseAtMiddle) motion.currentTime = endTime * 0.45
            else motion.finish()
            resolve({
              from,
              middle,
              to,
              height,
              landingRadius,
              beforeLanding,
              headerTop,
              reveal,
            })
          })
          observer.observe(document.body, { subtree: true, childList: true })
        })
      }, pauseAtMiddle)

    // Register the observer before input so the measurement survives slow browser test runs.
    const opening = readMorph()
    await launcher.click()
    const open = await opening
    const panel = await composer.boundingBox()
    if (!panel) throw new Error('Expected a visible composer')
    expect(open.from).toBeCloseTo(start.width, 0)
    expect(open.middle).toBeGreaterThan(open.from)
    expect(open.middle).toBeLessThan(open.to)
    expect(open.to).toBeCloseTo(panel.width, 0)
    expect(open.height).toBeCloseTo(panel.height, 0)
    expect(open.reveal).toMatchObject({
      blur: /^blur\([1-9]/,
      clip: /^inset\(/,
      visible: true,
      outsideHit: false,
    })

    const header = await page.locator('.wisp-header').boundingBox()
    if (!header) throw new Error('Expected a visible conversation row')
    const closing = readMorph()
    await page.getByRole('button', { name: 'Close chat' }).click()
    const close = await closing
    expect(close.headerTop).toBeCloseTo(header.y, 0)
    expect(close.from).toBeCloseTo(panel.width, 0)
    expect(close.middle).toBeLessThan(close.from)
    expect(close.middle).toBeGreaterThan(close.to)
    expect(close.to).toBeCloseTo(start.width, 0)
    expect(close.height).toBeCloseTo(start.height, 0)
    expect(close.landingRadius).toBeCloseTo(start.height / 2, 0)
    expect(open.beforeLanding).toBeCloseTo(open.to, 0)
    expect(close.beforeLanding).toBeCloseTo(close.to, 0)
    await expect(launcher).toBeFocused()
    await expect(composer).toHaveCount(0)

    const interrupted = readMorph(true)
    await launcher.click()
    const partial = await interrupted
    const reversal = readMorph()
    await page.getByRole('button', { name: 'Close chat' }).click()
    expect((await reversal).from).toBeCloseTo(partial.middle, 0)
    await expect(launcher).toBeFocused()

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await launcher.click()
    await expect(composer).toBeVisible()
    await expect(page.locator('.wisp-chat-morph')).toHaveCount(0)
  })

  test(`${framework} softens the chat before shrinking the composer`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(`/?framework=${framework}`)
    await page.getByRole('button', { name: 'Open chat', exact: true }).click()
    await expect(page.locator('.wisp-chat-morph')).toHaveCount(0)
    await expect(page.locator('.wisp-thread')).toHaveCSS('mask-image', 'none')

    const closing = page.evaluate(() => {
      return new Promise<
        | { composerPresent: false }
        | {
            composerPresent: true
            frames: {
              width: number
              opacity: number
              blur: number
              clip: string
              messageBlur: number
            }[]
          }
      >((resolve) => {
        const observer = new MutationObserver(() => {
          const shell = document.querySelector('.wisp-chat-morph')
          const motion = shell?.getAnimations()[0]
          if (!shell || !motion) return
          observer.disconnect()
          const content = document.querySelector(
            '.wisp-composer > :not(.wisp-chat-morph)',
          )
          if (!content) {
            resolve({ composerPresent: false })
            return
          }
          const thread = document.querySelector('.wisp-thread')
          const row = thread?.querySelector(
            '.wisp-thread-fade > div > :last-child',
          )
          const animations = [
            motion,
            ...content.getAnimations(),
            ...(thread?.getAnimations({ subtree: true }) ?? []),
          ]
          const blur = (filter: string) =>
            Number.parseFloat(filter.slice(5)) || 0
          const frames = [0, 39, 72, 188].map((time) => {
            for (const animation of animations) {
              animation.pause()
              animation.currentTime = time
            }
            const style = getComputedStyle(content)
            return {
              width: shell.getBoundingClientRect().width,
              opacity: Number(style.opacity),
              blur: blur(style.filter),
              clip: style.clipPath,
              messageBlur: row ? blur(getComputedStyle(row).filter) : 0,
            }
          })
          for (const animation of animations) animation.finish()
          resolve({ composerPresent: true, frames })
        })
        observer.observe(document.body, { subtree: true, childList: true })
      })
    })
    await page.getByRole('button', { name: 'Close chat' }).click()
    const result = await closing
    expect(result.composerPresent).toBe(true)
    if (!result.composerPresent) return
    const [start, hold, beforeShrink, shrinking] = result.frames
    if (!start || !hold || !beforeShrink || !shrinking) {
      throw new Error('Expected four samples of the closing animation.')
    }
    expect(start).toMatchObject({ opacity: 1, blur: 0, messageBlur: 0 })
    expect(hold).toMatchObject({ opacity: 1, blur: 0 })
    expect(beforeShrink.width).toBeCloseTo(start.width, 0)
    expect(beforeShrink.blur).toBeGreaterThan(hold.blur)
    expect(shrinking.width).toBeLessThan(start.width)
    expect(shrinking.clip).toMatch(/^inset\(/)
    expect(shrinking.messageBlur).toBeGreaterThan(4)
    await expect(page.locator('.wisp-composer')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeFocused()
  })

  test(`${framework} reveals the chat after the composer starts expanding`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(`/?framework=${framework}`)
    const opening = page.evaluate(() => {
      return new Promise<{
        start: string
        duringDelay: string
        threadReveal: string
        toolbarReveal: string
        feather: string
        messageBlur: string[]
        toolbarBlur: string
      }>((resolve) => {
        const observer = new MutationObserver(() => {
          const shell = document.querySelector('.wisp-chat-morph')
          const composer = shell?.getAnimations()[0]
          const toolbar = document.querySelector('.wisp-header')
          const thread = document.querySelector('.wisp-thread')
          if (!composer || !toolbar || !thread) return
          observer.disconnect()
          const foreground = [
            ...toolbar.getAnimations(),
            ...thread.getAnimations({ subtree: true }),
          ]
          const setTime = (time: number) => {
            for (const animation of foreground) {
              animation.pause()
              animation.currentTime = time
            }
          }
          setTime(0)
          const start = getComputedStyle(thread).maskPosition
          setTime(99)
          const duringDelay = getComputedStyle(thread).maskPosition
          setTime(140)
          const threadReveal = getComputedStyle(thread).maskPosition
          const messageBlur = Array.from(
            thread.querySelectorAll('.wisp-thread-fade > div > *'),
            (row) => getComputedStyle(row).filter,
          )
          setTime(195)
          const toolbarReveal = getComputedStyle(toolbar).maskPosition
          const toolbarBlur = getComputedStyle(toolbar).filter
          const feather = getComputedStyle(thread).maskImage
          setTime(320)
          composer.finish()
          resolve({
            start,
            duringDelay,
            threadReveal,
            toolbarReveal,
            feather,
            messageBlur,
            toolbarBlur,
          })
        })
        observer.observe(document.body, { subtree: true, childList: true })
      })
    })
    await page.getByRole('button', { name: 'Open chat', exact: true }).click()
    const reveal = await opening
    expect(reveal.duringDelay).toBe(reveal.start)
    expect(reveal.threadReveal).not.toBe(reveal.start)
    expect(reveal.toolbarReveal).toMatch(/^0px -?[0-9]/)
    expect(reveal.feather).toContain('120px')
    expect(reveal.messageBlur).toContain('blur(12px)')
    expect(reveal.toolbarBlur).toMatch(/^blur\([1-9]/)
    await expect(page.locator('.wisp-chat-morph')).toHaveCount(0)
    const toolbar = page.locator('.wisp-header')
    await expect(toolbar).toHaveCSS('scale', 'none')
    await expect(toolbar).toHaveCSS('mask-image', /linear-gradient/)
    await page.evaluate(() => {
      for (const region of document.querySelectorAll(
        '.wisp-header, .wisp-thread',
      ))
        for (const animation of region.getAnimations({ subtree: true })) {
          if (animation.playState === 'paused') animation.finish()
        }
    })
    await expect(toolbar).toHaveCSS('mask-image', 'none')
    await expect(toolbar).toHaveCSS('filter', 'none')
    await page.getByRole('button', { name: 'Close chat' }).click()
    await expect(toolbar).toHaveCount(0)
  })
}

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
