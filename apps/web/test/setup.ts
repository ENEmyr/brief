import '@testing-library/jest-dom/vitest'

class MockIO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = globalThis.IntersectionObserver ?? MockIO

// jsdom's Blob has no arrayBuffer(), and newer Node builds Response.blob() from the
// global (jsdom) Blob, so a fetched image blob could not be read in tests.
Blob.prototype.arrayBuffer ??= function (this: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(this)
  })
}
// jsdom has no object URLs either; a test that checks them stubs its own.
URL.createObjectURL ??= () => 'blob:test'
URL.revokeObjectURL ??= () => {}

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

// jsdom has no layout: getClientRects is always empty and checkVisibility is
// missing. This one reads only `display`, which jsdom does compute for the
// hidden attribute and inline styles, so a test can hide an element that way.
const displayed = (el: Element | null): boolean =>
  el === null || (getComputedStyle(el).display !== 'none' && displayed(el.parentElement))
const elementProto: Partial<Pick<Element, 'checkVisibility'>> = Element.prototype
elementProto.checkVisibility ??= function (this: Element) {
  return displayed(this)
}
