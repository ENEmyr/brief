import '@testing-library/jest-dom/vitest'

class MockIO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = globalThis.IntersectionObserver ?? MockIO

// jsdom has no matchMedia. The reader shell reads its 880px breakpoint and
// reduced motion through it; with no media engine, nothing matches (a wide
// screen with motion), and a test that needs a match stubs it itself.
window.matchMedia =
  window.matchMedia ??
  ((query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }))
