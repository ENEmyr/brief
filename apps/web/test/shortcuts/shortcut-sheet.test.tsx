import { describe, it, expect, vi, afterEach } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ShortcutSheet } from '@/features/shortcuts'

afterEach(() => {
  vi.restoreAllMocks()
})

/** Mounts the sheet the way the shell will: from a trigger, unmounted by onClose. */
function Shell({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.focus()
          setOpen(true)
        }}
      >
        Shortcuts
      </button>
      {open && (
        <ShortcutSheet
          onClose={() => {
            onClose()
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function openSheet() {
  const onClose = vi.fn()
  const view = render(<Shell onClose={onClose} />)
  const trigger = screen.getByRole('button', { name: 'Shortcuts' })
  fireEvent.click(trigger)
  return { ...view, onClose, trigger, dialog: screen.getByRole('dialog', { name: 'Keyboard shortcuts' }) }
}

function sheetCells() {
  const grid = screen.getByText('show all shortcuts').parentElement!
  return Array.from(grid.children, (cell) => cell.textContent)
}

describe('ShortcutSheet', () => {
  it('lists exactly the registry rows, keys as separate chips', () => {
    const { dialog } = openSheet()

    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(sheetCells()).toEqual([
      'CtrlK',
      'command palette and search',
      'JK',
      'next and previous section',
      '19',
      'pick an option in the focused question',
      'N',
      'jump to next unanswered question',
      // components.md:88-90.
      'HNA',
      'highlight, note or ask on the selected text',
      'CtrlEnter',
      'copy the prompt',
      '?',
      'show all shortcuts',
      'Esc',
      'close and return focus to the trigger',
    ])
    expect(Array.from(dialog.querySelectorAll('kbd'), (kbd) => kbd.textContent)).toEqual([
      'Ctrl',
      'K',
      'J',
      'K',
      '1',
      '9',
      'N',
      'H',
      'N',
      'A',
      'Ctrl',
      'Enter',
      '?',
      'Esc',
    ])
  })

  it('shows ⌘ for the mod key on Apple platforms', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    openSheet()

    expect(sheetCells()[0]).toBe('⌘K')
  })

  it('Escape closes it and returns focus to the trigger', () => {
    const { onClose, trigger } = openSheet()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('the Close button closes it', () => {
    const { onClose } = openSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not bounce focus to the trigger when the shell re-renders with a new onClose', () => {
    const { trigger, dialog, rerender } = openSheet()
    const focusTrigger = vi.fn()
    trigger.addEventListener('focus', focusTrigger)

    rerender(<Shell onClose={() => {}} />)

    expect(focusTrigger).not.toHaveBeenCalled()
    expect(dialog).toHaveFocus()
  })

  it('closes on an overlay click but not on a click inside the panel', () => {
    const { onClose, dialog } = openSheet()

    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(dialog.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
