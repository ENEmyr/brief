import { describe, it, expect, vi } from 'vitest'
import { useRef, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Dialog, DialogActions, useDialogFocus } from '@/features/export'

function Harness({ busy = false, onClose = () => {} }: { busy?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  const primaryRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <Dialog
          title="Test dialog"
          busy={busy}
          initialFocusRef={primaryRef}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
        >
          <DialogActions>
            <button>Cancel</button>
            <button ref={primaryRef}>Go</button>
            <button disabled>Later</button>
          </DialogActions>
        </Dialog>
      )}
    </>
  )
}

describe('Dialog shell (interactions.md, B-Overlays BEHAVIOR)', () => {
  it('is a modal dialog labelled by its title, focuses the given element and returns focus to the trigger', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'open' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Test dialog' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Go' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps Tab inside, skipping a disabled last button', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    const go = screen.getByRole('button', { name: 'Go' })

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(go).toHaveFocus()
  })

  it('skips controls that are not rendered at either end of the Tab loop', () => {
    function Panel() {
      const panelRef = useRef<HTMLDivElement>(null)
      useDialogFocus(panelRef, () => {})
      return (
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Edges" tabIndex={-1}>
          <div hidden>
            <button>Peek</button>
          </div>
          <button>First</button>
          <button>Last</button>
          <button style={{ display: 'none' }}>Gone</button>
        </div>
      )
    }
    render(<Panel />)
    const first = screen.getByRole('button', { name: 'First' })
    const last = screen.getByRole('button', { name: 'Last' })

    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(first).toHaveFocus()
  })

  it("Tab also reaches a toast's buttons, and from outside the loop goes back in", () => {
    render(
      <>
        <Harness />
        <div data-toast="">
          <button>Retry</button>
        </div>
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    const close = screen.getByRole('button', { name: 'Close' })
    const retry = screen.getByRole('button', { name: 'Retry' })

    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(retry).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()

    ;(document.activeElement as HTMLElement).blur()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()
  })

  it('Escape and a scrim click close it, except while busy; the close button always does', () => {
    const onClose = vi.fn()
    const { rerender } = render(<Harness busy onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<Harness onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('locks body scroll while any dialog is open and restores it after the last one closes', () => {
    document.body.style.overflow = 'scroll'
    const first = render(<Dialog title="One" onClose={() => {}}>one</Dialog>)
    expect(document.body.style.overflow).toBe('hidden')
    const second = render(<Dialog title="Two" onClose={() => {}}>two</Dialog>)

    first.unmount()
    expect(document.body.style.overflow).toBe('hidden')
    second.unmount()
    expect(document.body.style.overflow).toBe('scroll')
    document.body.style.overflow = ''
  })

  it('a panel that is not aria-modal, such as a menu, leaves page scroll alone', () => {
    function Menu() {
      const panelRef = useRef<HTMLDivElement>(null)
      useDialogFocus(panelRef, () => {})
      return (
        <div ref={panelRef} role="menu">
          <button role="menuitem">Item</button>
        </div>
      )
    }
    render(<Menu />)
    expect(document.body.style.overflow).toBe('')
  })
})
