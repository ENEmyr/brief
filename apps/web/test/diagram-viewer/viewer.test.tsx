import { describe, it, expect, vi } from 'vitest'
import { render, screen, renderHook, act, fireEvent } from '@testing-library/react'
import { ViewerOverlay, useViewer } from '@/features/diagram-viewer'

const SVG_CONTENT = '<svg data-testid="diagram-svg"><circle r="1" /></svg>'

function getTransformHost() {
  return screen.getByTestId('diagram-svg').parentElement as HTMLElement
}

describe('useViewer', () => {
  it('starts with content null and sets/clears it via open/close', () => {
    const { result } = renderHook(() => useViewer())
    expect(result.current.content).toBeNull()

    act(() => result.current.open(SVG_CONTENT))
    expect(result.current.content).toBe(SVG_CONTENT)

    act(() => result.current.close())
    expect(result.current.content).toBeNull()
  })
})

describe('ViewerOverlay', () => {
  it('renders nothing when content is null', () => {
    render(<ViewerOverlay content={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a dialog with the injected content when open', () => {
    render(<ViewerOverlay content={SVG_CONTENT} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: /diagram viewer/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByTestId('diagram-svg')).toBeInTheDocument()
  })

  it('exposes toolbar buttons with accessible names and a 44px hit floor', () => {
    render(<ViewerOverlay content={SVG_CONTENT} onClose={vi.fn()} />)

    for (const name of ['Zoom out', 'Zoom in', 'Fit to screen', 'Close viewer']) {
      const button = screen.getByRole('button', { name })
      expect(button.className).toContain('min-h-11')
      expect(button.className).toContain('min-w-11')
    }
  })

  it('zooms in and out via the toolbar buttons, changing the transform scale', () => {
    render(<ViewerOverlay content={SVG_CONTENT} onClose={vi.fn()} />)

    const host = getTransformHost()
    expect(host.style.transform).toContain('scale(1)')

    act(() => screen.getByRole('button', { name: 'Zoom in' }).click())
    const scaleAfterIn = host.style.transform
    expect(scaleAfterIn).not.toContain('scale(1)')
    const zoomedInMatch = scaleAfterIn.match(/scale\(([\d.]+)\)/)
    expect(Number(zoomedInMatch?.[1])).toBeGreaterThan(1)

    act(() => screen.getByRole('button', { name: 'Zoom out' }).click())
    act(() => screen.getByRole('button', { name: 'Zoom out' }).click())
    const scaleAfterOut = host.style.transform.match(/scale\(([\d.]+)\)/)
    expect(Number(scaleAfterOut?.[1])).toBeLessThan(1)
  })

  it('resets pan and zoom to the fit state via the Fit button', () => {
    render(<ViewerOverlay content={SVG_CONTENT} onClose={vi.fn()} />)

    const host = getTransformHost()
    act(() => screen.getByRole('button', { name: 'Zoom in' }).click())
    act(() => screen.getByRole('button', { name: 'Zoom in' }).click())
    expect(host.style.transform).not.toContain('scale(1)')

    act(() => screen.getByRole('button', { name: 'Fit to screen' }).click())
    expect(host.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('calls onClose when the Close button is clicked', () => {
    const onClose = vi.fn()
    render(<ViewerOverlay content={SVG_CONTENT} onClose={onClose} />)

    act(() => screen.getByRole('button', { name: 'Close viewer' }).click())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<ViewerOverlay content={SVG_CONTENT} onClose={onClose} />)

    const dialog = screen.getByRole('dialog')
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the dialog on open and restores it to the previously focused element on close', () => {
    const outsideButton = document.createElement('button')
    outsideButton.textContent = 'outside'
    document.body.appendChild(outsideButton)
    outsideButton.focus()
    expect(document.activeElement).toBe(outsideButton)

    const { rerender } = render(<ViewerOverlay content={SVG_CONTENT} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toHaveFocus()

    rerender(<ViewerOverlay content={null} onClose={vi.fn()} />)
    expect(document.activeElement).toBe(outsideButton)
    document.body.removeChild(outsideButton)
  })

  it('zooms on wheel (deltaY < 0 zooms in) via a non-passive native listener', () => {
    render(<ViewerOverlay content={SVG_CONTENT} onClose={vi.fn()} />)

    const host = getTransformHost()
    const overlay = screen.getByRole('dialog').parentElement as HTMLElement

    act(() => {
      fireEvent.wheel(overlay, { deltaY: -100 })
    })

    const match = host.style.transform.match(/scale\(([\d.]+)\)/)
    expect(Number(match?.[1])).toBeGreaterThan(1)
  })

  it('ignores pointerdown on the toolbar so dragging a toolbar button does not start a pan', () => {
    render(<ViewerOverlay content={SVG_CONTENT} onClose={vi.fn()} />)

    const host = getTransformHost()
    const zoomInButton = screen.getByRole('button', { name: 'Zoom in' })

    act(() => {
      fireEvent.pointerDown(zoomInButton, { pointerId: 1, clientX: 10, clientY: 10 })
    })

    expect(host.style.transform).toBe('translate(0px, 0px) scale(1)')
  })
})
