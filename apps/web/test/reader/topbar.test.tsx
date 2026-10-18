import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Topbar } from '@/features/reader/components/Topbar'
import type { ReaderView } from '@/features/reader/lib/views'

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'light')
})

describe('Topbar', () => {
  it('shows the logo tile, the session id with its slash and the title (B-Reader), no wordmark', () => {
    render(<Topbar sessionId="abc12345678901" title="Rate limiting" />)

    expect(screen.getByText('b')).toBeInTheDocument()
    expect(screen.getByText('abc123 /')).toBeInTheDocument()
    expect(screen.getByText('Rate limiting')).toBeInTheDocument()
    expect(screen.queryByText('Brief')).not.toBeInTheDocument()
    expect(screen.queryByText(/session/i)).not.toBeInTheDocument()
  })

  it('prints only the first 6 characters of the session id, as B-Reader:44 draws it', () => {
    render(<Topbar sessionId="k2p9x4Qm7Zr1Ta" />)

    expect(screen.getByText('k2p9x4 /')).toBeInTheDocument()
    expect(screen.queryByText(/k2p9x4Qm7Zr1Ta/)).not.toBeInTheDocument()
  })

  it('prints a session id shorter than 6 characters whole', () => {
    render(<Topbar sessionId="sess1" />)
    expect(screen.getByText('sess1 /')).toBeInTheDocument()
  })

  it('omits the session id when no sessionId is provided', () => {
    render(<Topbar />)
    expect(screen.queryByText(/ \/$/)).not.toBeInTheDocument()
  })

  it('does not render an Archive button when onSave is not provided', () => {
    render(<Topbar sessionId="sess1" />)
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })

  it('orders the wide controls as B-Reader does: Edit, Download, Archive, theme, Share', () => {
    const onSave = vi.fn()
    render(
      <Topbar sessionId="sess1" onSave={onSave} onEditPrompt={vi.fn()} onDownload={vi.fn()} onShare={vi.fn()} />,
    )

    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)
    const order = ['Edit', 'Download', 'Archive', 'Theme: light. Switch to dark', 'Share'].map((n) => names.indexOf(n))
    expect(order.every((at) => at >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('fills the Archive icon and names it "Archived" once the doc is archived, so assistive tech hears the state', () => {
    const { rerender } = render(<Topbar sessionId="sess1" onSave={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Archive' }).querySelector('svg')).toHaveAttribute('fill', 'none')

    rerender(<Topbar sessionId="sess1" onSave={vi.fn()} archived />)
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
    const archived = screen.getByRole('button', { name: 'Archived' })
    expect(archived).toHaveAttribute('title', 'Archived')
    expect(archived.querySelector('svg')).toHaveAttribute('fill', 'currentColor')
  })

  it('the theme button names the current theme and switches it', () => {
    render(<Topbar />)
    fireEvent.click(screen.getByRole('button', { name: 'Theme: light. Switch to dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Theme: dark. Switch to light' })).toBeInTheDocument()
  })

  it('view tabs: Document, Diagrams, Raw; click and arrow keys pick a view', () => {
    const onViewChange = vi.fn<(view: ReaderView) => void>()
    render(<Topbar view="document" onViewChange={onViewChange} />)

    const tablist = screen.getByRole('tablist', { name: 'View' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Document', 'Diagrams', 'Raw'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')

    fireEvent.click(tabs[2]!)
    expect(onViewChange).toHaveBeenLastCalledWith('raw')
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' })
    expect(onViewChange).toHaveBeenLastCalledWith('diagrams')
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowLeft' })
    expect(onViewChange).toHaveBeenLastCalledWith('raw')
  })

  it('a disabled view tab cannot be picked and arrow keys skip it', () => {
    const onViewChange = vi.fn<(view: ReaderView) => void>()
    render(<Topbar view="document" onViewChange={onViewChange} disabledViews={new Set<ReaderView>(['diagrams'])} />)

    const diagrams = screen.getByRole('tab', { name: 'Diagrams' })
    expect(diagrams).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Document' }), { key: 'ArrowRight' })
    expect(onViewChange).toHaveBeenLastCalledWith('raw')
  })

  it('the "Jump to..." field and the narrow Search button both open the palette', () => {
    const onOpenPalette = vi.fn()
    render(<Topbar onOpenPalette={onOpenPalette} paletteHint="Ctrl K" />)

    const field = screen.getByRole('button', { name: /Jump to\.\.\./ })
    expect(field).toHaveTextContent('Jump to...Ctrl K')
    fireEvent.click(field)
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onOpenPalette).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['saved', 'saved'],
    ['saving', 'saving'],
    ['device', 'this device'],
    ['tab', 'this tab only'],
  ] as const)('save chip %s reads "%s" in a polite live region', (status, text) => {
    render(<Topbar saveStatus={status} />)
    const chip = screen.getByRole('status')
    expect(chip).toHaveTextContent(text)
    expect(chip).toHaveAttribute('aria-live', 'polite')
  })

  it('the saved chip carries the board tooltip', () => {
    render(<Topbar saveStatus="saved" />)
    expect(screen.getByRole('status')).toHaveAttribute('title', 'Answers saved on this device and synced')
  })

  it('shows the section counter and opens the outline from the narrow bar', () => {
    const onOpenOutline = vi.fn()
    render(<Topbar sectionCounter="§02 / 04" onOpenOutline={onOpenOutline} />)
    expect(screen.getByText('§02 / 04')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open outline' }))
    expect(onOpenOutline).toHaveBeenCalledTimes(1)
  })

  it('More actions lists every wide action and runs the picked one', () => {
    const handlers = {
      onEditPrompt: vi.fn(),
      onDownload: vi.fn(),
      onPrint: vi.fn(),
      onSave: vi.fn(),
      onShare: vi.fn(),
    }
    render(<Topbar {...handlers} />)

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    const menu = screen.getByRole('menu', { name: 'More actions' })
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Copy edit prompt',
      'Markdown',
      'PDF',
      'Archive',
      'Theme: light. Switch to dark',
      'Share',
    ])

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Share' }))
    expect(handlers.onShare).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('draws the reading progress line only when asked', () => {
    const { rerender } = render(<Topbar />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    rerender(<Topbar showProgress />)
    expect(screen.getByRole('progressbar', { name: 'Reading progress' })).toBeInTheDocument()
  })
})
