import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Toc } from '@/features/toc'

const sections = [
  { id: 's1', no: 1, title: 'Introduction' },
  { id: 's2', no: 2, title: 'Getting Started' },
]

function mountSectionElements() {
  document.body.innerHTML = `
    <section data-section="s1" id="s1"></section>
    <section data-section="s2" id="s2"></section>
  `
}

type MockEntry = {
  target: Element
  isIntersecting: boolean
  boundingClientRect: { top: number }
}

// Controllable IntersectionObserver double for exercising useActiveSection's
// scroll-spy logic. The real setup.ts guard (`?? MockIO`) is left untouched —
// this class is swapped in per-test via vi.stubGlobal and reverted in
// afterEach so it never leaks into other test files.
class ControllableIntersectionObserver {
  static instances: ControllableIntersectionObserver[] = []
  callback: (entries: MockEntry[]) => void
  observedTargets: Element[] = []

  constructor(callback: (entries: MockEntry[]) => void) {
    this.callback = callback
    ControllableIntersectionObserver.instances.push(this)
  }

  observe(target: Element) {
    this.observedTargets.push(target)
  }

  unobserve(target: Element) {
    this.observedTargets = this.observedTargets.filter((t) => t !== target)
  }

  disconnect() {
    this.observedTargets = []
  }
}

function getObserver(): ControllableIntersectionObserver {
  const instance = ControllableIntersectionObserver.instances.at(-1)
  if (!instance) {
    throw new Error(
      'no IntersectionObserver instance was created — sections were likely not found synchronously (check mountSectionElements ran before render)',
    )
  }
  return instance
}

describe('toc', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders a list item for each section', () => {
    render(<Toc sections={sections} />)

    expect(screen.getByText(/1\. Introduction/)).toBeInTheDocument()
    expect(screen.getByText(/2\. Getting Started/)).toBeInTheDocument()
  })

  it('scrolls the matching section into view on click', () => {
    mountSectionElements()
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(<Toc sections={sections} />)
    fireEvent.click(screen.getByText(/2\. Getting Started/))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('toggles and persists the collapsed state', () => {
    render(<Toc sections={sections} />)

    expect(localStorage.getItem('idocs:toc')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /collapse table of contents/i }))
    expect(localStorage.getItem('idocs:toc')).toBe('closed')

    fireEvent.click(screen.getByRole('button', { name: /expand table of contents/i }))
    expect(localStorage.getItem('idocs:toc')).toBe('open')
  })

  it('renders the toc nav landmark', () => {
    render(<Toc sections={sections} />)
    expect(screen.getByRole('navigation', { name: /table of contents/i })).toBeInTheDocument()
  })
})

describe('toc scroll spy', () => {
  beforeEach(() => {
    localStorage.clear()
    ControllableIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', ControllableIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks the top-most intersecting section active', () => {
    mountSectionElements()
    render(<Toc sections={sections} />)
    const observer = getObserver()
    const s1 = document.querySelector('[data-section="s1"]') as Element

    act(() => {
      observer.callback([{ target: s1, isIntersecting: true, boundingClientRect: { top: 40 } }])
    })

    expect(screen.getByRole('button', { name: /1\. Introduction/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('button', { name: /2\. Getting Started/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('a later entry with a smaller top wins over a previously stored one', () => {
    mountSectionElements()
    render(<Toc sections={sections} />)
    const observer = getObserver()
    const s1 = document.querySelector('[data-section="s1"]') as Element
    const s2 = document.querySelector('[data-section="s2"]') as Element

    act(() => {
      observer.callback([{ target: s1, isIntersecting: true, boundingClientRect: { top: 100 } }])
    })
    expect(screen.getByRole('button', { name: /1\. Introduction/ })).toHaveAttribute(
      'aria-current',
      'true',
    )

    // Real IntersectionObserver callbacks only report targets whose
    // intersection changed, so s1's prior entry is expected to persist in
    // the hook's internal map while this later, smaller-top entry for s2
    // arrives on its own.
    act(() => {
      observer.callback([{ target: s2, isIntersecting: true, boundingClientRect: { top: 20 } }])
    })

    expect(screen.getByRole('button', { name: /2\. Getting Started/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('button', { name: /1\. Introduction/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('keeps the last active section when nothing is intersecting (sticky)', () => {
    mountSectionElements()
    render(<Toc sections={sections} />)
    const observer = getObserver()
    const s2 = document.querySelector('[data-section="s2"]') as Element

    act(() => {
      observer.callback([{ target: s2, isIntersecting: true, boundingClientRect: { top: 10 } }])
    })
    expect(screen.getByRole('button', { name: /2\. Getting Started/ })).toHaveAttribute(
      'aria-current',
      'true',
    )

    act(() => {
      observer.callback([{ target: s2, isIntersecting: false, boundingClientRect: { top: -200 } }])
    })

    expect(screen.getByRole('button', { name: /2\. Getting Started/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})
