import '@testing-library/jest-dom/vitest'

class MockIO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = globalThis.IntersectionObserver ?? MockIO
