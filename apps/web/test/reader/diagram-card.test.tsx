import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { DiagramCard } from '@/features/reader/components/DiagramCard'
import { DiagramViewerProvider } from '@/features/diagram-viewer'

// jsdom has no PointerEvent constructor, so fireEvent.pointer* would silently
// drop pointerId/clientX/clientY and make the gesture assertions vacuous.
class PointerEventPolyfill extends MouseEvent {
  pointerId: number
  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props)
    this.pointerId = props.pointerId ?? 0
  }
}
globalThis.PointerEvent =
  globalThis.PointerEvent ?? (PointerEventPolyfill as unknown as typeof PointerEvent)

function renderWithProvider(ui: React.ReactNode) {
  return render(<DiagramViewerProvider>{ui}</DiagramViewerProvider>)
}

function renderCard() {
  renderWithProvider(
    <DiagramCard caption="seq">
      <svg data-testid="diagram" />
    </DiagramCard>,
  )
}

const getTransformHost = () => screen.getByTestId('diagram').parentElement as HTMLElement
const getBody = () => getTransformHost().parentElement as HTMLElement

describe('DiagramCard', () => {
  it('renders the chrome: caption text and an Expand button', () => {
    renderCard()
    expect(screen.getByText('seq')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand diagram' })).toBeInTheDocument()
  })

  it('expands the live diagram node into the viewer when Expand is clicked', () => {
    renderWithProvider(
      <DiagramCard caption="seq">
        <svg data-testid="diagram" viewBox="0 0 10 10" />
      </DiagramCard>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Expand diagram' }))

    const dialog = screen.getByRole('dialog', { name: 'Diagram viewer' })
    // Rendered by React, not injected as an HTML string, so the element itself
    // (attributes included) appears in the dialog subtree.
    expect(within(dialog).getByTestId('diagram')).toHaveAttribute('viewBox', '0 0 10 10')
  })

  it('does NOT expand when the diagram body is clicked', () => {
    // The body used to expand on any click, which hijacked clicks meant for the
    // diagram and left no gesture budget for panning it in place.
    renderCard()
    fireEvent.click(screen.getByTestId('diagram'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

  it('does not render an Expand button or zoom controls when expandable is false', () => {
    renderWithProvider(
      <DiagramCard caption="code" expandable={false}>
        <pre data-testid="json">{'{}'}</pre>
      </DiagramCard>,
    )
    expect(screen.queryByRole('button', { name: 'Expand diagram' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument()
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

  describe('inline gesture contract (the card sits inside a scrolling document)', () => {
    it('never captures one-finger touch, so a swipe over a diagram still scrolls the page', () => {
      renderCard()
      expect(getBody().style.touchAction).toBe('pan-y')
    })

    it('does not pan at rest, so a drag near the diagram is not hijacked', () => {
      renderCard()
      act(() => {
        fireEvent.pointerDown(getBody(), { pointerId: 1, clientX: 0, clientY: 0 })
        fireEvent.pointerMove(getBody(), { pointerId: 1, clientX: 60, clientY: 20 })
      })
      expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(1)')
    })

    it('pans once zoomed in', () => {
      renderCard()
      act(() => screen.getByRole('button', { name: 'Zoom in' }).click())
      act(() => {
        fireEvent.pointerDown(getBody(), { pointerId: 1, clientX: 0, clientY: 0 })
        fireEvent.pointerMove(getBody(), { pointerId: 1, clientX: 60, clientY: 20 })
      })
      expect(getTransformHost().style.transform).toContain('translate(60px, 20px)')
    })

    it('Reset returns the inline diagram to 1:1', () => {
      // Inline gets Reset rather than the overlay's measured Fit: the content
      // already fills its box here, so a fit would land near-but-not-on 1.
      renderCard()
      act(() => screen.getByRole('button', { name: 'Zoom in' }).click())
      expect(getTransformHost().style.transform).not.toContain('scale(1)')

      act(() => screen.getByRole('button', { name: 'Reset zoom' }).click())
      expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(1)')
    })

    it('leaves a bare wheel to the page and zooms only on ctrl/cmd+wheel', () => {
      renderCard()
      const host = getTransformHost()

      act(() => {
        fireEvent.wheel(getBody(), { deltaY: -100 })
      })
      expect(host.style.transform).toContain('scale(1)')

      act(() => {
        fireEvent.wheel(getBody(), { deltaY: -100, ctrlKey: true })
      })
      expect(Number(host.style.transform.match(/scale\(([\d.]+)\)/)?.[1])).toBeGreaterThan(1)
    })
  })
})
