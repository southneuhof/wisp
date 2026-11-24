const delay = 100
const duration = 300
const feather = 120
const blur = 12

export function animateChatReveal(root, opening, previousEdge) {
  const history = root.querySelector('.wisp-history')
  const thread = history?.querySelector('.wisp-thread')
  const toolbar = history?.querySelector('.wisp-header')
  const regions = [thread, toolbar].filter(Boolean)
  if (!regions.length) return

  const bounds = history.getBoundingClientRect()
  const hidden = bounds.bottom + 4
  const shown = bounds.top - feather - 4
  const from = previousEdge ?? (opening ? hidden : shown)
  const to = opening ? shown : hidden

  const timing = {
    delay: opening && previousEdge === undefined ? delay : 0,
    duration:
      (opening ? duration : 256) *
      Math.min(1, Math.abs(to - from) / (hidden - shown)),
    easing: opening
      ? 'cubic-bezier(0.25, 0.45, 0.32, 1)'
      : 'cubic-bezier(0.29, 0.12, 0.26, 1)',
    fill: 'both',
  }
  const maskSize = `100% ${Math.ceil(bounds.height + 2 * feather + 12)}px`
  const masks = regions.map((element) => {
    const { top } = element.getBoundingClientRect()
    const mask = (edge) => ({
      maskImage: `linear-gradient(to bottom, transparent, black ${feather}px, black)`,
      maskRepeat: 'no-repeat',
      maskSize,
      maskPosition: `0px ${edge - top}px`,
    })
    return element.animate([mask(from), mask(to)], timing)
  })

  const viewport = thread?.querySelector('.wisp-thread-fade')
  const rows = viewport?.firstElementChild?.children
  const viewportBounds = viewport?.getBoundingClientRect() ?? bounds
  const blurTargets = [...(rows?.length ? rows : [thread]), toolbar].filter(
    Boolean,
  )
  const animations = [...masks]
  for (const element of blurTargets) {
    const clip = element === toolbar ? bounds : viewportBounds
    const rect = element.getBoundingClientRect()
    const top = Math.max(rect.top, clip.top)
    const bottom = Math.min(rect.bottom, clip.bottom)
    if (bottom <= top || from === to) continue
    const peak = bottom - feather * 0.25
    const clear = Math.max(top, bottom - 76) - feather - 4
    const stops = [peak, clear]
      .map((edge) => (edge - from) / (to - from))
      .filter((offset) => offset > 0 && offset < 1)
      .sort((a, b) => a - b)
    const frames = [0, ...stops, 1].map((offset) => {
      const edge = from + (to - from) * offset
      const strength = Math.max(0, Math.min(1, (edge - clear) / (peak - clear)))
      return { offset, filter: `blur(${blur * strength}px)` }
    })
    animations.push(element.animate(frames, timing))
  }

  return {
    finished: masks[0].finished,
    edge: () => {
      const progress = masks[0].effect.getComputedTiming().progress ?? 0
      return from + (to - from) * progress
    },
    cancel: () => {
      for (const animation of animations) animation.cancel()
    },
  }
}
