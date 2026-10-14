import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
import { Toc, useActiveSection, type TocProps } from '@/features/toc'

const sections = [
  { id: 's1', no: 1, title: 'Introduction' },
  { id: 's2', no: 2, title: 'Getting Started' },
]

function renderToc(overrides: Partial<TocProps> = {}) {
  const props: TocProps = {
    sections,
    activeId: null,
    marks: [],
    onJump: vi.fn(),
    onMarkJump: vi.fn(),
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    drawerOpen: false,
    onCloseDrawer: vi.fn(),
    ...overrides,
  }
  const utils = render(<Toc {...props} />)
  return { ...utils, props }
}

// The active section is tracked by SessionReady (it also drives the mobile
// section counter) and passed down; this harness wires the hook the same way.
function SpiedToc() {
  const activeId = useActiveSection(sections.map((s) => s.id))
  return (
    <Toc
      sections={sections}
      activeId={activeId}
      marks={[]}
      onJump={vi.fn()}
      onMarkJump={vi.fn()}
      collapsed={false}
      onToggleCollapsed={vi.fn()}
      drawerOpen={false}
      onCloseDrawer={vi.fn()}
    />
  )
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

describe('outline (expanded)', () => {
  it('renders a row with the zero-padded number and title for each section', () => {
    renderToc()

    expect(screen.getByRole('link', { name: /01\s*Introduction/ })).toHaveAttribute('href', '#s1')
    expect(screen.getByRole('link', { name: /02\s*Getting Started/ })).toHaveAttribute('href', '#s2')
    expect(screen.getByText('OUTLINE')).toBeInTheDocument()
  })

  it('jumps to the section on click (the shell scrolls and flashes) and closes the drawer', () => {
    const onJump = vi.fn()
    const onCloseDrawer = vi.fn()
    renderToc({ onJump, onCloseDrawer })

    fireEvent.click(screen.getByRole('link', { name: /02\s*Getting Started/ }))

    expect(onJump).toHaveBeenCalledWith('s2')
    expect(onCloseDrawer).toHaveBeenCalledTimes(1)
  })

  it('renders the Outline nav landmark', () => {
    renderToc()
    expect(screen.getByRole('navigation', { name: 'Outline' })).toBeInTheDocument()
  })

  it('marks the current section with aria-current and the chip fill', () => {
    renderToc({ activeId: 's2' })
    const current = screen.getByRole('link', { name: /02\s*Getting Started/ })
    expect(current).toHaveAttribute('aria-current', 'true')
    expect(current).toHaveClass('bg-chip', 'text-text', 'font-medium')
    expect(screen.getByRole('link', { name: /01\s*Introduction/ })).not.toHaveAttribute('aria-current')
  })

  it('calls onToggleCollapsed (does not manage its own collapsed state) when the toggle is clicked', () => {
    const onToggleCollapsed = vi.fn()
    renderToc({ collapsed: false, onToggleCollapsed })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse outline' }))
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1)
    // Still expanded: Toc is controlled, it never flips `collapsed` itself.
    expect(screen.getByRole('link', { name: /01\s*Introduction/ })).toBeInTheDocument()
  })

  it('puts a warn dot on sections an open decision refers to', () => {
    renderToc({ openSectionIds: new Set(['s2']) })
    const row = screen.getByRole('link', { name: /02\s*Getting Started/ })
    expect(within(row).getByRole('img', { name: 'open decisions' })).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: /01\s*Introduction/ })).queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('outline: your marks', () => {
  const marks = [
    { id: 'h1', sectionId: 's1', text: 'burst traffic', ask: false },
    { id: 'h2', sectionId: 's2', text: 'why 429', ask: true },
  ]

  // B-States "No notes".
  it('with no marks shows NOTES 0 and how to make one', () => {
    renderToc()
    expect(screen.queryByText('YOUR MARKS')).not.toBeInTheDocument()
    expect(screen.getByText('NOTES 0')).toBeInTheDocument()
    expect(screen.getByText('Select any text to highlight it, add a note, or ask the agent about it.')).toBeInTheDocument()
  })

  it('lists each mark by its text: amber swatch for highlights, lime outline for asks', () => {
    renderToc({ marks })
    expect(screen.getByText('YOUR MARKS')).toBeInTheDocument()
    expect(screen.queryByText('NOTES 0')).not.toBeInTheDocument()
    const highlight = screen.getByRole('link', { name: 'burst traffic' })
    const ask = screen.getByRole('link', { name: 'why 429' })
    expect(highlight).toHaveAttribute('href', '#s1')
    expect(highlight.querySelector('span')).toHaveClass('bg-[var(--c-warn-fill)]')
    expect(ask.querySelector('span')).toHaveClass('border-accent-line')
  })

  it('jumps to the mark on click', () => {
    const onMarkJump = vi.fn()
    renderToc({ marks, onMarkJump })
    fireEvent.click(screen.getByRole('link', { name: 'why 429' }))
    expect(onMarkJump).toHaveBeenCalledWith(marks[1])
  })
})

describe('outline (collapsed to a rail)', () => {
  it('renders only numbers, no titles, until hovered', () => {
    renderToc({ collapsed: true })

    expect(screen.queryByText('Introduction')).not.toBeInTheDocument()
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '1. Introduction' })).toHaveTextContent('01')
    expect(screen.getByRole('button', { name: 'Expand outline' })).toBeInTheDocument()
  })

  it('shows titles on hover and hides them again on mouse leave', () => {
    renderToc({ collapsed: true })
    const hoverZone = screen.getByRole('navigation', { name: 'Outline' })

    fireEvent.mouseEnter(hoverZone)
    expect(screen.getByText('Introduction')).toBeInTheDocument()

    fireEvent.mouseLeave(hoverZone)
    expect(screen.queryByText('Introduction')).not.toBeInTheDocument()
  })

  it('clears hover state when the toggle is clicked', () => {
    // onToggleCollapsed is a mock, so `collapsed` never actually flips here.
    // The point is handleToggleCollapsed's own setHovered(false).
    const onToggleCollapsed = vi.fn()
    renderToc({ collapsed: true, onToggleCollapsed })
    const hoverZone = screen.getByRole('navigation', { name: 'Outline' })

    fireEvent.mouseEnter(hoverZone)
    expect(screen.getByText('Introduction')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Expand outline' })[0]!)
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Introduction')).not.toBeInTheDocument()
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument()
  })
})

describe('outline drawer', () => {
  it('does not render when drawerOpen is false', () => {
    renderToc({ drawerOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders as a dialog with the section items when drawerOpen is true', () => {
    renderToc({ drawerOpen: true })

    const dialog = screen.getByRole('dialog', { name: 'Outline' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText('Introduction')).toBeInTheDocument()
  })

  it('keeps the 44px touch target floor (min-h-11) on every drawer item (bug-089)', () => {
    renderToc({ drawerOpen: true, marks: [{ id: 'h1', sectionId: 's1', text: 'burst', ask: false }] })

    const dialog = screen.getByRole('dialog', { name: 'Outline' })
    const items = within(dialog).getAllByRole('link')
    expect(items).toHaveLength(sections.length + 1)
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

    const { rerender, props } = renderToc({ drawerOpen: true })
    expect(screen.getByRole('dialog')).toHaveFocus()

    rerender(<Toc {...props} drawerOpen={false} />)
    expect(document.activeElement).toBe(outsideButton)
    document.body.removeChild(outsideButton)
  })
})

describe('outline scroll spy', () => {
  beforeEach(() => {
    ControllableIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', ControllableIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function row(name: RegExp) {
    return screen.getByRole('link', { name })
  }

  it('marks the top-most intersecting section active', () => {
    mountSectionElements()
    render(<SpiedToc />)
    const observer = getObserver()
    const s1 = document.querySelector('[data-section="s1"]') as Element

    act(() => {
      observer.callback([{ target: s1, isIntersecting: true, boundingClientRect: { top: 40 } }])
    })

    expect(row(/01\s*Introduction/)).toHaveAttribute('aria-current', 'true')
    expect(row(/02\s*Getting Started/)).not.toHaveAttribute('aria-current')
  })

  it('a later entry with a smaller top wins over a previously stored one', () => {
    mountSectionElements()
    render(<SpiedToc />)
    const observer = getObserver()
    const s1 = document.querySelector('[data-section="s1"]') as Element
    const s2 = document.querySelector('[data-section="s2"]') as Element

    act(() => {
      observer.callback([{ target: s1, isIntersecting: true, boundingClientRect: { top: 100 } }])
    })
    expect(row(/01\s*Introduction/)).toHaveAttribute('aria-current', 'true')

    // Real IntersectionObserver callbacks only report targets whose
    // intersection changed, so s1's prior entry is expected to persist in
    // the hook's internal map while this later, smaller-top entry for s2
    // arrives on its own.
    act(() => {
      observer.callback([{ target: s2, isIntersecting: true, boundingClientRect: { top: 20 } }])
    })

    expect(row(/02\s*Getting Started/)).toHaveAttribute('aria-current', 'true')
    expect(row(/01\s*Introduction/)).not.toHaveAttribute('aria-current')
  })

  it('keeps the last active section when nothing is intersecting (sticky)', () => {
    mountSectionElements()
    render(<SpiedToc />)
    const observer = getObserver()
    const s2 = document.querySelector('[data-section="s2"]') as Element

    act(() => {
      observer.callback([{ target: s2, isIntersecting: true, boundingClientRect: { top: 10 } }])
    })
    expect(row(/02\s*Getting Started/)).toHaveAttribute('aria-current', 'true')

    act(() => {
      observer.callback([{ target: s2, isIntersecting: false, boundingClientRect: { top: -200 } }])
    })

    expect(row(/02\s*Getting Started/)).toHaveAttribute('aria-current', 'true')
  })
})
