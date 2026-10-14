import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { BlockRenderer } from '@/features/reader'

// features.md B2: a stat counts up once, 600ms, the first time it is on
// screen, never again, and not at all under reduced motion.

class TestObserver {
  static all: TestObserver[] = []
  disconnected = false
  constructor(private readonly callback: IntersectionObserverCallback) {
    TestObserver.all.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true
  }
  enter() {
    act(() => this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never))
  }
}

let frames: FrameRequestCallback[] = []
function frame(now: number) {
  const pending = frames
  frames = []
  act(() => pending.forEach((cb) => cb(now)))
}

beforeEach(() => {
  TestObserver.all = []
  frames = []
  vi.stubGlobal('IntersectionObserver', TestObserver)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => vi.unstubAllGlobals())

const stat = (value: string): Extract<Block, { type: 'stat' }> => ({
  type: 'stat',
  items: [{ label: 'Peak RPS', value }],
})
const counter = () => document.querySelector('[data-count-up]')

describe('stat count-up', () => {
  it("waits for the stat to come on screen, counts for 600ms, then shows the agent's text", () => {
    render(<BlockRenderer block={stat('4,800')} />)
    expect(screen.getByText('4,800')).toHaveClass('invisible', 'print:visible')
    expect(counter()).toBeNull()

    TestObserver.all[0]!.enter()
    frame(1000)
    expect(counter()).toHaveTextContent(/^0$/)
    expect(counter()).toHaveAttribute('aria-hidden', 'true')
    frame(1300)
    const halfway = Number(counter()!.textContent!.replace(',', ''))
    expect(halfway).toBeGreaterThan(4000)
    expect(halfway).toBeLessThan(4800)
    frame(1600)
    expect(counter()).toBeNull()
    expect(screen.getByText('4,800')).not.toHaveClass('invisible')
    expect(TestObserver.all[0]!.disconnected).toBe(true)
  })

  it('never counts the same stat a second time, even after it remounts', () => {
    const block = stat('4,800')
    const first = render(<BlockRenderer block={block} />)
    TestObserver.all[0]!.enter()
    frame(0)
    frame(600)
    first.unmount()

    render(<BlockRenderer block={block} />)
    expect(screen.getByText('4,800')).not.toHaveClass('invisible')
    expect(TestObserver.all).toHaveLength(1)
    expect(frames).toHaveLength(0)
  })

  it('shows the final value at once under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
    }))
    render(<BlockRenderer block={stat('4,800')} />)
    expect(screen.getByText('4,800')).not.toHaveClass('invisible')
    expect(TestObserver.all).toHaveLength(0)
  })

  it('shows a value that is not one number at once', () => {
    render(<BlockRenderer block={stat('5–30 ms')} />)
    expect(screen.getByText('5–30 ms')).not.toHaveClass('invisible')
    // Nothing to count, so nothing waits for the screen or runs frames.
    expect(TestObserver.all).toHaveLength(0)
    expect(frames).toHaveLength(0)
    expect(counter()).toBeNull()
  })
})
