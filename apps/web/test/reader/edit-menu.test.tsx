import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Topbar } from '@/features/reader/components/Topbar'

describe('Topbar Edit menu', () => {
  it('does not render the Edit menu when onEditPrompt is not provided', () => {
    render(<Topbar sessionId="sess1" />)
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  function renderMenu() {
    const onEditPrompt = vi.fn()
    render(<Topbar sessionId="sess1" onEditPrompt={onEditPrompt} />)
    return { onEditPrompt, trigger: screen.getByRole('button', { name: 'Edit' }) }
  }

  it('is closed until the trigger is clicked, then exposes the copy action', () => {
    const { trigger } = renderMenu()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    expect(screen.getByRole('menu', { name: 'Edit' })).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: /Copy edit prompt/ })).toBeInTheDocument()
  })

  it('"Copy edit prompt" fires onEditPrompt and closes the menu', () => {
    const { onEditPrompt, trigger } = renderMenu()
    fireEvent.click(trigger)

    fireEvent.click(screen.getByRole('menuitem', { name: /Copy edit prompt/ }))

    expect(onEditPrompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('focuses the item on open, and Escape closes it and restores focus to the trigger', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger)

    expect(screen.getByRole('menuitem', { name: /Copy edit prompt/ })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  // Regression for the click-away bug inherited from a pre-fix copy of
  // DownloadMenu: a `position: fixed` overlay rendered inside Topbar's header
  // (which has `backdrop-blur`, making it a containing block for fixed
  // descendants) resolves `inset-0` against the ~56px header box, not the
  // viewport, so a click on the page body never reached it. jsdom has no
  // layout, so it cannot reproduce the coordinate bug directly -- this
  // instead pins the actual fix: a document-level pointerdown listener with
  // no viewport-covering element involved at all.
  it('closes on a document-level pointerdown outside the menu, wherever the target is', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('does not close on a pointerdown inside the panel (an item click still runs its own close)', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger)

    fireEvent.pointerDown(screen.getByRole('menuitem', { name: /Copy edit prompt/ }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('re-clicking the trigger toggles the menu closed instead of being raced by the outside-click listener', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('ArrowDown/ArrowUp/Home/End move focus with roving navigation, wrapping over the single item', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger)

    const copyItem = screen.getByRole('menuitem', { name: /Copy edit prompt/ })
    expect(copyItem).toHaveFocus()

    fireEvent.keyDown(copyItem, { key: 'ArrowDown' })
    expect(copyItem).toHaveFocus()

    fireEvent.keyDown(copyItem, { key: 'ArrowUp' })
    expect(copyItem).toHaveFocus()

    fireEvent.keyDown(copyItem, { key: 'End' })
    expect(copyItem).toHaveFocus()

    fireEvent.keyDown(copyItem, { key: 'Home' })
    expect(copyItem).toHaveFocus()
  })

  it('renders between Archive and Download when both are present', () => {
    render(
      <Topbar
        sessionId="sess1"
        onSave={vi.fn()}
        onEditPrompt={vi.fn()}
        onDownload={vi.fn()}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const saveIndex = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Archive')
    const editIndex = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Edit')
    const downloadIndex = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Download')
    expect(saveIndex).toBeGreaterThanOrEqual(0)
    expect(editIndex).toBeGreaterThan(saveIndex)
    expect(downloadIndex).toBeGreaterThan(editIndex)
  })
})
