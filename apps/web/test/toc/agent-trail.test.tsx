import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Toc, type TocProps } from '@/features/toc'

function renderToc(overrides: Partial<TocProps> = {}) {
  const props: TocProps = {
    sections: [{ id: 's1', no: 1, title: 'Introduction' }],
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
  render(<Toc {...props} />)
  return props
}

describe('outline Agent trail row', () => {
  it('is absent when the document has no trajectory block', () => {
    renderToc()
    expect(screen.queryByRole('link', { name: /Agent trail/ })).not.toBeInTheDocument()
  })

  it('shows the label and the flag count', () => {
    renderToc({ trail: { flags: 3, onJump: vi.fn() } })
    expect(screen.getByRole('link', { name: 'Agent trail 3 flags' })).toBeInTheDocument()
  })

  it('uses the singular for one flag', () => {
    renderToc({ trail: { flags: 1, onJump: vi.fn() } })
    expect(screen.getByRole('link', { name: 'Agent trail 1 flag' })).toBeInTheDocument()
  })

  it('shows 0 flags when the trajectory has no flagged step', () => {
    renderToc({ trail: { flags: 0, onJump: vi.fn() } })
    expect(screen.getByRole('link', { name: 'Agent trail 0 flags' })).toBeInTheDocument()
  })

  it('jumps to the trajectory block and closes the drawer when activated', () => {
    const onJump = vi.fn()
    const onCloseDrawer = vi.fn()
    renderToc({ trail: { flags: 2, onJump }, onCloseDrawer })
    fireEvent.click(screen.getByRole('link', { name: /Agent trail/ }))
    expect(onJump).toHaveBeenCalledTimes(1)
    expect(onCloseDrawer).toHaveBeenCalledTimes(1)
  })

  it('is reachable from the keyboard', () => {
    renderToc({ trail: { flags: 2, onJump: vi.fn() } })
    const row = screen.getByRole('link', { name: /Agent trail/ })
    expect(row).toHaveAttribute('href')
    expect(row.tabIndex).toBeGreaterThanOrEqual(0)
    row.focus()
    expect(row).toHaveFocus()
  })

  it('also appears in the mobile drawer', () => {
    renderToc({ trail: { flags: 2, onJump: vi.fn() }, drawerOpen: true })
    const dialog = screen.getByRole('dialog', { name: 'Outline' })
    expect(within(dialog).getByRole('link', { name: 'Agent trail 2 flags' })).toBeInTheDocument()
  })
})
