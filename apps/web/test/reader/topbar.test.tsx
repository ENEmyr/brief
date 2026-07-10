import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Topbar } from '@/features/reader/components/Topbar'

describe('Topbar', () => {
  it('renders brand, session chip, theme toggle, and print button', () => {
    render(<Topbar sessionId="abc12345678901" repo="https://github.com/example/repo" />)

    expect(screen.getByText('Brief')).toBeInTheDocument()
    expect(screen.getByText('abc12345678901')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
  })

  it('omits the session chip when no sessionId is provided', () => {
    render(<Topbar />)

    expect(screen.getByText('Brief')).toBeInTheDocument()
    expect(screen.queryByText(/session/i)).not.toBeInTheDocument()
  })

  it('does not render a Save button when onSave is not provided', () => {
    render(<Topbar sessionId="sess1" />)
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('renders a Save button before Markdown and fires onSave when clicked', () => {
    const onSave = vi.fn()
    const onDownload = vi.fn()
    render(<Topbar sessionId="sess1" onSave={onSave} onDownload={onDownload} />)

    const buttons = screen.getAllByRole('button')
    const saveIndex = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Save')
    const downloadIndex = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Download markdown')
    expect(saveIndex).toBeGreaterThanOrEqual(0)
    expect(downloadIndex).toBeGreaterThan(saveIndex)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not render the saved chip when savedLabel is not provided', () => {
    render(<Topbar sessionId="sess1" onSave={vi.fn()} />)
    expect(screen.queryByText('saved')).not.toBeInTheDocument()
  })

  it('renders a mono "saved" chip next to the session chip when savedLabel is provided', () => {
    render(<Topbar sessionId="sess1" onSave={vi.fn()} savedLabel="saved" />)
    expect(screen.getByText('saved')).toBeInTheDocument()
  })
})
