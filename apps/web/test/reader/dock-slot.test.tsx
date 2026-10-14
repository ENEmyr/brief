import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import type { Decision } from '@brief/schema'
import { DockSlot } from '@/features/reader/components/DockSlot'
import { ReaderStateProvider } from '@/features/reader-state'

const decisions: Decision[] = [
  { id: 'D1', q: 'Which limiter?', multi: false, opts: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
  { id: 'D2', q: 'Which limit?', multi: false, opts: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
  { id: 'D3', q: 'Which key?', multi: true, opts: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
]

function narrowScreen(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(max-width: 879px)' ? matches : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <DockSlot decisions={decisions} open={open} onOpenChange={setOpen}>
        <p>dock content</p>
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
    narrowScreen(false)
    renderDock()
    const dock = screen.getByRole('complementary', { name: 'Decision dock' })
    expect(within(dock).getByText('dock content')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open dock' })).not.toBeInTheDocument()
  })

  it('narrow: a peek bar with the progress line and the next open decision', () => {
    narrowScreen(true)
    localStorage.clear()
    renderDock()
    expect(screen.getByText('0 of 3, next D1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open dock' })).toBeInTheDocument()
  })

  it('narrow: Open dock turns the slot into a modal sheet; Close dock and Escape close it and focus returns', () => {
    narrowScreen(true)
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
})
