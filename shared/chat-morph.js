import { animateChatReveal } from './chat-reveal.js'

const launcherSelector = '.wisp-chat-launcher'
const composerSelector = '.wisp-composer'
const easing = 'cubic-bezier(0.2, 0.75, 0.25, 1)'
const duration = 320

function readSurface(element) {
  const bounds = element.getBoundingClientRect()
  const style = element.ownerDocument.defaultView.getComputedStyle(element)
  const [horizontal, vertical = horizontal] = style.borderTopLeftRadius
    .split(' ')
    .map(parseFloat)
  const width = parseFloat(style.width) || bounds.width
  const height = parseFloat(style.height) || bounds.height
  // CSS reduces overlapping corners by one factor for both axes.
  const radiusScale =
    1 / Math.max(1, (horizontal * 2) / width, (vertical * 2) / height)
  return {
    left: bounds.left,
    bottom: bounds.bottom,
    width: bounds.width,
    height: bounds.height,
    radiusX: horizontal * radiusScale * (bounds.width / width),
    radiusY: vertical * radiusScale * (bounds.height / height),
    color: style.backgroundColor,
    shadow: style.boxShadow,
  }
}

function interpolate(from, to, progress) {
  return from + (to - from) * progress
}

function keyframe(surface, width, height) {
  const scaleX = surface.width / width
  const scaleY = surface.height / height
  return {
    offset: surface.offset,
    transform: `translate3d(${surface.left}px, ${surface.bottom - surface.height}px, 0) scale(${scaleX}, ${scaleY})`,
    borderRadius: `${surface.radiusX / scaleX}px / ${surface.radiusY / scaleY}px`,
    ...(surface.color && {
      backgroundColor: surface.color,
      boxShadow: surface.shadow,
    }),
  }
}

function clipKeyframe(surface, bounds) {
  const { left, bottom, width, height, radiusX, radiusY, offset } = surface
  const insets = [
    bottom - height - bounds.top,
    bounds.right - left - width,
    bounds.bottom - bottom,
    left - bounds.left,
  ]
  return {
    offset,
    clipPath: `inset(${insets.map((value) => `${value}px`).join(' ')} round ${radiusX}px / ${radiusY}px)`,
  }
}

function clipKeyframes(from, middle, to, bounds) {
  const frames = []
  for (const [start, end] of [
    [from, middle],
    [middle, to],
  ]) {
    // The shell scales its own corners. The contents stay unscaled.
    for (let sample = 0; sample < 8; sample++) {
      const t = sample / 8
      const width = interpolate(start.width, end.width, t)
      const height = interpolate(start.height, end.height, t)
      frames.push(
        clipKeyframe(
          {
            offset: interpolate(start.offset, end.offset, t),
            left: interpolate(start.left, end.left, t),
            bottom: interpolate(start.bottom, end.bottom, t),
            width,
            height,
            radiusX:
              width *
              interpolate(
                start.radiusX / start.width,
                end.radiusX / end.width,
                t,
              ),
            radiusY:
              height *
              interpolate(
                start.radiusY / start.height,
                end.radiusY / end.height,
                t,
              ),
          },
          bounds,
        ),
      )
    }
  }
  frames.push(clipKeyframe(to, bounds))
  return frames
}

export function createChatMorph() {
  let pending
  let running
  let reveal

  function clearSurface() {
    if (!running) return
    const { root, shell, motion, contents, clip, label } = running
    running = undefined
    motion.cancel()
    contents?.cancel()
    clip?.cancel()
    label?.cancel()
    shell.remove()
    delete root.dataset.wispMorph
    root.style.removeProperty('--wisp-closing-composer-space')
  }

  function clearReveal() {
    reveal?.cancel()
    reveal = undefined
  }

  function cancel() {
    pending = undefined
    clearSurface()
    clearReveal()
  }

  function start(root, opening) {
    const view = root.ownerDocument.defaultView
    const composer = opening ? undefined : root.querySelector(composerSelector)
    const element =
      running?.shell ??
      (opening ? root.querySelector(launcherSelector) : composer)
    const from =
      element?.animate &&
      view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === false
        ? readSurface(element)
        : undefined

    const style = composer && view?.getComputedStyle(composer)
    const composerSpace = style
      ? composer.getBoundingClientRect().height +
        parseFloat(style.marginTop) +
        parseFloat(style.marginBottom)
      : 0

    const edge = reveal?.edge()
    cancel()
    if (from?.width && from.height)
      pending = { root, opening, from, composerSpace, edge }
  }

  function play() {
    if (!pending) return
    const { root, opening, from, composerSpace, edge } = pending
    pending = undefined
    const target = root.querySelector(
      opening ? composerSelector : launcherSelector,
    )
    if (!target) return
    const to = readSurface(target)
    const { width, height } = to
    if (!width || !height) return

    const shell = root.ownerDocument.createElement('div')
    shell.className = 'wisp-chat-morph'
    shell.setAttribute('aria-hidden', 'true')
    shell.style.width = `${width}px`
    shell.style.height = `${height}px`
    const content = opening ? target.firstElementChild : undefined
    if (composerSpace > 0) {
      root.style.setProperty(
        '--wisp-closing-composer-space',
        `${composerSpace}px`,
      )
    }
    root.dataset.wispMorph = opening ? 'opening' : 'closing'
    // Paint the opening surface above the chat backdrop, in the composer's layer.
    const layer = opening ? target : root
    layer.prepend(shell)

    // Stretch horizontally before the panel rises. Closing gathers the height first.
    const midWidth = interpolate(from.width, width, opening ? 0.65 : 0.35)
    const midHeight = interpolate(from.height, height, opening ? 0.29 : 0.71)
    const midCenter = interpolate(
      from.left + from.width / 2,
      to.left + width / 2,
      0.5,
    )
    const first = { ...from, offset: 0 }
    const middle = {
      offset: 0.48,
      left: midCenter - midWidth / 2,
      bottom: interpolate(from.bottom, to.bottom, 0.5),
      width: midWidth,
      height: midHeight,
      radiusX: Math.min(midWidth / 2, midHeight * 0.44),
      radiusY: midHeight * 0.44,
    }
    const last = { ...to, offset: 1 }
    const timing = { duration, easing, fill: 'both' }
    const motion = shell.animate(
      [first, middle, last].map((surface) => keyframe(surface, width, height)),
      timing,
    )
    const clip = content?.animate(
      clipKeyframes(first, middle, last, content.getBoundingClientRect()),
      timing,
    )
    const contents = content?.animate(
      [
        { opacity: 0, filter: 'blur(16px)' },
        { opacity: 0, filter: 'blur(16px)', offset: 0.35 },
        { opacity: 1, filter: 'blur(0px)' },
      ],
      { duration, fill: 'both' },
    )

    const labelElement = root.querySelector(launcherSelector)?.firstElementChild
    const label = labelElement?.animate(
      opening
        ? [{ opacity: 1 }, { opacity: 0, offset: 0.18 }, { opacity: 0 }]
        : [{ opacity: 0 }, { opacity: 0, offset: 0.72 }, { opacity: 1 }],
      { duration, fill: 'both' },
    )

    const foreground = animateChatReveal(root, opening, edge)
    reveal = foreground
    if (foreground) {
      void foreground.finished.then(
        () => {
          if (opening && reveal === foreground) clearReveal()
        },
        () => {},
      )
    }

    running = { root, shell, motion, contents, clip, label }
    motion.onfinish = () => {
      if (running?.motion !== motion) return
      clearSurface()
      if (!opening) clearReveal()
    }
  }

  return { start, play, cancel }
}
