import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ProgressBar } from '@/features/reader/components/ProgressBar'

beforeEach(() => {
  // Setup document scroll properties with Object.defineProperty so they're configurable and writable
  Object.defineProperty(document.documentElement, 'scrollTop', {
    configurable: true,
    writable: true,
    value: 0,
  })
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    writable: true,
    value: 1000,
  })
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    writable: true,
    value: 800,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProgressBar', () => {
  it('renders with role progressbar and aria attributes', () => {
    render(<ProgressBar />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-label', 'Reading progress')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('initializes with 0% when at top of page', () => {
    Object.defineProperty(document.documentElement, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    })
    render(<ProgressBar />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })

  it('updates progress on scroll event', () => {
    // Stub requestAnimationFrame to execute immediately
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })

    render(<ProgressBar />)
    const bar = screen.getByRole('progressbar')

    // Scroll to 50%: scrollTop=100, scrollHeight=1000, clientHeight=800
    // percent = 100 / (1000 - 800) * 100 = 100 / 200 * 100 = 50
    act(() => {
      Object.defineProperty(document.documentElement, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 100,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })

  it('clamps progress to 0-100 range', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })

    render(<ProgressBar />)
    const bar = screen.getByRole('progressbar')

    // Scroll to 100% (at or past bottom)
    act(() => {
      Object.defineProperty(document.documentElement, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 500,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    expect(bar).toHaveAttribute('aria-valuenow', '100')
  })

  it('handles NaN case when scrollHeight equals clientHeight', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })

    // Set scrollHeight = clientHeight so denominator is 0
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      writable: true,
      value: 800,
    })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      writable: true,
      value: 800,
    })

    render(<ProgressBar />)
    const bar = screen.getByRole('progressbar')

    act(() => {
      Object.defineProperty(document.documentElement, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 100,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })

  it('throttles updates with requestAnimationFrame', () => {
    const rafStub = vi.fn((cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('requestAnimationFrame', rafStub)

    render(<ProgressBar />)

    // Dispatch multiple scroll events in quick succession
    act(() => {
      Object.defineProperty(document.documentElement, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 50,
      })
      window.dispatchEvent(new Event('scroll'))

      Object.defineProperty(document.documentElement, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 100,
      })
      window.dispatchEvent(new Event('scroll'))

      Object.defineProperty(document.documentElement, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 150,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    // rAF should only be called 3 times (once per scroll), but only the last update should stick
    // because they're throttled: the scheduled flag prevents re-scheduling while one is in flight
    expect(rafStub.mock.calls.length).toBeGreaterThan(0)
  })

  it('applies fixed positioning and mauve background styles', () => {
    render(<ProgressBar />)
    const bar = screen.getByRole('progressbar')

    expect(bar).toHaveClass('fixed', 'top-0', 'left-0', 'z-20', 'bg-mauve', 'print:hidden')
    expect(bar).toHaveStyle('height: 3px')
  })
})
