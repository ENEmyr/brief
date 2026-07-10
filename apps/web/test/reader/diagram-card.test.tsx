import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DiagramCard } from '@/features/reader/components/DiagramCard'
import { DiagramViewerProvider } from '@/features/diagram-viewer'

function renderWithProvider(ui: React.ReactNode) {
  return render(<DiagramViewerProvider>{ui}</DiagramViewerProvider>)
}

describe('DiagramCard', () => {
  it('renders the chrome: caption text and an Expand button', () => {
    renderWithProvider(
      <DiagramCard caption="seq">
        <svg data-testid="diagram" />
      </DiagramCard>,
    )
    expect(screen.getByText('seq')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand diagram' })).toBeInTheDocument()
  })

  it('opens the viewer with the body svg outerHTML when Expand is clicked', () => {
    renderWithProvider(
      <DiagramCard caption="seq">
        <svg data-testid="diagram" viewBox="0 0 10 10" />
      </DiagramCard>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Expand diagram' }))
    const dialog = screen.getByRole('dialog', { name: 'Diagram viewer' })
    expect(within(dialog).getByTestId('diagram')).toBeInTheDocument()
    expect(dialog.innerHTML).toContain('viewBox="0 0 10 10"')
  })

  it('expands on a body click outside interactive elements', () => {
    renderWithProvider(
      <DiagramCard caption="seq">
        <svg data-testid="diagram" />
      </DiagramCard>,
    )
    fireEvent.click(screen.getByTestId('diagram'))
    expect(screen.getByRole('dialog', { name: 'Diagram viewer' })).toBeInTheDocument()
  })

  it('does not expand when clicking a button inside the body', () => {
    renderWithProvider(
      <DiagramCard caption="seq">
        <svg data-testid="diagram" />
        <button type="button">Play</button>
      </DiagramCard>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not render an Expand button or wire body-click expansion when expandable is false', () => {
    renderWithProvider(
      <DiagramCard caption="code" expandable={false}>
        <pre data-testid="json">{'{}'}</pre>
      </DiagramCard>,
    )
    expect(screen.queryByRole('button', { name: 'Expand diagram' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('json'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders optional controls in their own row', () => {
    renderWithProvider(
      <DiagramCard caption="seq" controls={<button type="button">Step</button>}>
        <svg data-testid="diagram" />
      </DiagramCard>,
    )
    expect(screen.getByRole('button', { name: 'Step' })).toBeInTheDocument()
  })

  it('renders without a DiagramViewerProvider and does not crash on Expand click (no-op open)', () => {
    render(
      <DiagramCard caption="seq">
        <svg data-testid="diagram" />
      </DiagramCard>,
    )
    expect(screen.getByText('seq')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand diagram' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
