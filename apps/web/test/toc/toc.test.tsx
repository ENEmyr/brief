import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
import { Toc, type TocProps } from '@/features/toc'

const sections = [
  { id: 's1', no: 1, title: 'Introduction' },
  { id: 's2', no: 2, title: 'Getting Started' },
]

function renderToc(overrides: Partial<TocProps> = {}) {
  const props: TocProps = {
    sections,
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    drawerOpen: false,
    onCloseDrawer: vi.fn(),
    ...overrides,
  }
  const utils = render(<Toc {...props} />)
  return { ...utils, props }
}

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

describe('toc (expanded)', () => {
  it('renders a nav item with number and title for each section', () => {
    renderToc()

    expect(screen.getByRole('button', { name: /01 Introduction/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /02 Getting Started/ })).toBeInTheDocument()
  })

  it('scrolls the matching section into view on click and closes the drawer', () => {
    mountSectionElements()
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const onCloseDrawer = vi.fn()

    renderToc({ onCloseDrawer })
    fireEvent.click(screen.getByRole('button', { name: /02 Getting Started/ }))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    expect(onCloseDrawer).toHaveBeenCalledTimes(1)
  })

  it('renders the toc nav landmark', () => {
    renderToc()
    expect(screen.getByRole('navigation', { name: /table of contents/i })).toBeInTheDocument()
  })

  it('calls onToggleCollapsed (does not manage its own collapsed state) when the toggle is clicked', () => {
    const onToggleCollapsed = vi.fn()
    renderToc({ collapsed: false, onToggleCollapsed })

    const toggle = screen.getByRole('button', { name: 'Collapse contents' })
    // Prototype parity (coordinator adjudication): expanded shows '«'.
    expect(toggle).toHaveTextContent('«')

    fireEvent.click(toggle)
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1)
    // Still expanded — Toc is controlled, it never flips `collapsed` itself.
    expect(screen.getByRole('button', { name: /01 Introduction/ })).toBeInTheDocument()
  })
})

describe('toc (collapsed to numbers)', () => {
  it('renders only numbers, no titles, until hovered', () => {
    renderToc({ collapsed: true })

    expect(screen.queryByText('Introduction')).not.toBeInTheDocument()
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'Expand contents' })
    // Prototype parity (coordinator adjudication): collapsed shows '»'.
    expect(toggle).toHaveTextContent('»')
  })

  it('shows titles on hover and hides them again on mouse leave', () => {
    const { container } = renderToc({ collapsed: true })
    const hoverZone = container.querySelector('nav > div') as Element

    fireEvent.mouseEnter(hoverZone)
    expect(screen.getByText('Introduction')).toBeInTheDocument()

    fireEvent.mouseLeave(hoverZone)
    expect(screen.queryByText('Introduction')).not.toBeInTheDocument()
  })

  it('clears hover state when the toggle is clicked', () => {
    // onToggleCollapsed is a mock, so `collapsed` never actually flips here —
    // this stays on the collapsed-to-numbers view throughout. The point is to
    // exercise handleToggleCollapsed's own `setHovered(false)` call, not a
    // parent-driven prop change (see the rerender-based version this replaced,
    // which could never fail because it re-rendered with collapsed={false}).
    const onToggleCollapsed = vi.fn()
    const { container } = renderToc({ collapsed: true, onToggleCollapsed })
    const hoverZone = container.querySelector('nav > div') as Element

    fireEvent.mouseEnter(hoverZone)
    expect(screen.getByText('Introduction')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expand contents' }))
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1)

    // Still collapsed (the prop never changed) — but hover state must have
    // been cleared by the click handler, so titles are hidden again.
    expect(screen.queryByText('Introduction')).not.toBeInTheDocument()
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument()
  })
})

describe('toc drawer', () => {
  it('does not render when drawerOpen is false', () => {
    renderToc({ drawerOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders as a dialog with the section items when drawerOpen is true', () => {
    renderToc({ drawerOpen: true })

    const dialog = screen.getByRole('dialog', { name: /table of contents/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText('Introduction')).toBeInTheDocument()
  })

  it('keeps the 44px touch target floor (min-h-11) on every drawer item', () => {
    renderToc({ drawerOpen: true })

    const dialog = screen.getByRole('dialog', { name: /table of contents/i })
    const items = within(dialog).getAllByRole('button')
    expect(items).toHaveLength(sections.length)
    for (const item of items) {
      expect(item.className).toContain('min-h-11')
    }
  })

  it('calls onCloseDrawer when Escape is pressed', () => {
    const onCloseDrawer = vi.fn()
    renderToc({ drawerOpen: true, onCloseDrawer })

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCloseDrawer).toHaveBeenCalledTimes(1)
  })

  it('calls onCloseDrawer when the overlay backdrop is clicked', () => {
    const onCloseDrawer = vi.fn()
    renderToc({ drawerOpen: true, onCloseDrawer })

    fireEvent.click(screen.getByRole('presentation'))
    expect(onCloseDrawer).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the dialog on open and restores it to the previously focused element on close', () => {
    const outsideButton = document.createElement('button')
    outsideButton.textContent = 'outside'
    document.body.appendChild(outsideButton)
    outsideButton.focus()
    expect(document.activeElement).toBe(outsideButton)

    const { rerender } = renderToc({ drawerOpen: true })
    expect(screen.getByRole('dialog')).toHaveFocus()

    rerender(
      <Toc
        sections={sections}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        drawerOpen={false}
        onCloseDrawer={vi.fn()}
      />,
    )
    expect(document.activeElement).toBe(outsideButton)
    document.body.removeChild(outsideButton)
  })
})

describe('toc scroll spy', () => {
  beforeEach(() => {
    ControllableIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', ControllableIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks the top-most intersecting section active', () => {
    mountSectionElements()
    renderToc()
    const observer = getObserver()
    const s1 = document.querySelector('[data-section="s1"]') as Element

    act(() => {
      observer.callback([{ target: s1, isIntersecting: true, boundingClientRect: { top: 40 } }])
    })

    expect(screen.getByRole('button', { name: /01 Introduction/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('button', { name: /02 Getting Started/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('a later entry with a smaller top wins over a previously stored one', () => {
    mountSectionElements()
    renderToc()
    const observer = getObserver()
    const s1 = document.querySelector('[data-section="s1"]') as Element
    const s2 = document.querySelector('[data-section="s2"]') as Element

    act(() => {
      observer.callback([{ target: s1, isIntersecting: true, boundingClientRect: { top: 100 } }])
    })
    expect(screen.getByRole('button', { name: /01 Introduction/ })).toHaveAttribute(
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

    expect(screen.getByRole('button', { name: /02 Getting Started/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('button', { name: /01 Introduction/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('keeps the last active section when nothing is intersecting (sticky)', () => {
    mountSectionElements()
    renderToc()
    const observer = getObserver()
    const s2 = document.querySelector('[data-section="s2"]') as Element

    act(() => {
      observer.callback([{ target: s2, isIntersecting: true, boundingClientRect: { top: 10 } }])
    })
    expect(screen.getByRole('button', { name: /02 Getting Started/ })).toHaveAttribute(
      'aria-current',
      'true',
    )

    act(() => {
      observer.callback([{ target: s2, isIntersecting: false, boundingClientRect: { top: -200 } }])
    })

    expect(screen.getByRole('button', { name: /02 Getting Started/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})
