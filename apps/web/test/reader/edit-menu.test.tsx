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

  it('renders between Save and Download when both are present', () => {
    render(
      <Topbar
        sessionId="sess1"
        onSave={vi.fn()}
        onEditPrompt={vi.fn()}
        onDownload={vi.fn()}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const saveIndex = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Save')
    const editIndex = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Edit')
    const downloadIndex = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Download')
    expect(saveIndex).toBeGreaterThanOrEqual(0)
    expect(editIndex).toBeGreaterThan(saveIndex)
    expect(downloadIndex).toBeGreaterThan(editIndex)
  })
})
