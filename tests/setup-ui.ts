import { vi } from 'vitest'
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)
vi.stubGlobal('IntersectionObserver', ResizeObserverStub)
if (!globalThis.PointerEvent) vi.stubGlobal('PointerEvent', MouseEvent)
HTMLElement.prototype.scrollTo = vi.fn()
HTMLElement.prototype.scrollIntoView = vi.fn()
