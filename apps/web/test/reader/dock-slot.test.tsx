import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import type { Decision } from '@brief/schema'
import { DockSlot } from '@/features/reader/components/DockSlot'
import { ReaderStateProvider, useReaderActions } from '@/features/reader-state'

const decisions: Decision[] = [
  { id: 'D1', q: 'Which limiter?', multi: false, opts: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
  { id: 'D2', q: 'Which limit?', multi: false, opts: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
  { id: 'D3', q: 'Which key?', multi: true, opts: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
]

// Width queries are evaluated the way a browser does, so the hook's query is
// tested for what it means at a width, not for its spelling. Browser zoom
// gives fractional CSS widths: 879.09 at 110% on a 967px window.
const WIDTH_FORMS: [RegExp, (width: number, n: number) => boolean][] = [
  [/^\(min-width: ([\d.]+)px\)$/, (width, n) => width >= n],
  [/^\(max-width: ([\d.]+)px\)$/, (width, n) => width <= n],
  [/^\(width < ([\d.]+)px\)$/, (width, n) => width < n],
  [/^\(width >= ([\d.]+)px\)$/, (width, n) => width >= n],
]

function matchesAt(width: number, query: string): boolean {
  if (!query.includes('width')) return false
  const negated = query.startsWith('not all and ')
  const feature = negated ? query.slice('not all and '.length) : query
  for (const [form, test] of WIDTH_FORMS) {
    const match = form.exec(feature)
    if (match) return test(width, Number(match[1])) !== negated
  }
  throw new Error(`no evaluator for the media query "${query}"`)
}

function viewport(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matchesAt(width, query),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

// Tailwind's `max-[880px]:` and `min-[880px]:` compile to these two queries.
const CSS_NARROW = 'not all and (min-width: 880px)'

function PickOption() {
  const { pickOption } = useReaderActions()
  return (
    <button type="button" onClick={() => pickOption('D1', 'a', false)}>
      pick D1 A
    </button>
  )
}

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <DockSlot decisions={decisions} open={open} onOpenChange={setOpen}>
        <p>dock content</p>
        <PickOption />
      </DockSlot>
    </>
  )
}

function renderDock() {
  return render(
    <ReaderStateProvider sessionId="dock-slot-test" persist={false}>
      <Harness />
    </ReaderStateProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DockSlot', () => {
  it('wide: a complementary landmark holding the content, no peek bar', () => {
    viewport(1440)
    renderDock()
    const dock = screen.getByRole('complementary', { name: 'Decision dock' })
    expect(within(dock).getByText('dock content')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open dock' })).not.toBeInTheDocument()
  })

  it.each([
    [879, true],
    [879.09, true],
    [879.5, true],
    [879.99, true],
    [880, false],
    [880.5, false],
  ])('at %spx the peek bar renders when the CSS is narrow (%s), never neither', (width, narrow) => {
    expect(matchesAt(width, CSS_NARROW)).toBe(narrow)
    viewport(width)
    renderDock()
    const peek = screen.queryByRole('button', { name: 'Open dock' })
    if (narrow) expect(peek).toBeInTheDocument()
    else expect(peek).not.toBeInTheDocument()
  })

  it('narrow: a peek bar with the progress line and the next open decision', () => {
    viewport(390)
    localStorage.clear()
    renderDock()
    expect(screen.getByText('0 of 3, next D1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open dock' })).toBeInTheDocument()
  })

  it('narrow: Open dock turns the slot into a modal sheet; Close dock and Escape close it and focus returns', () => {
    viewport(390)
    renderDock()
    const open = screen.getByRole('button', { name: 'Open dock' })
    open.focus()
    fireEvent.click(open)

    const sheet = screen.getByRole('dialog', { name: 'Decision dock' })
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(within(sheet).getByText('DECISIONS / 0/3')).toBeInTheDocument()

    fireEvent.click(within(sheet).getByRole('button', { name: 'Close dock' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open dock' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Open dock' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('narrow: answering inside the open sheet keeps focus on the control', () => {
    viewport(390)
    renderDock()
    fireEvent.click(screen.getByRole('button', { name: 'Open dock' }))
    const sheet = screen.getByRole('dialog', { name: 'Decision dock' })
    const pick = within(sheet).getByRole('button', { name: 'pick D1 A' })
    pick.focus()
    fireEvent.click(pick)
    expect(within(sheet).getByText('DECISIONS / 1/3')).toBeInTheDocument()
    expect(pick).toHaveFocus()
  })
})
