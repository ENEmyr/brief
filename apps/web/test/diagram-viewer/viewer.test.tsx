import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, renderHook, act, fireEvent } from '@testing-library/react'
import { ViewerOverlay, useViewer } from '@/features/diagram-viewer'

// jsdom has no PointerEvent constructor, so testing-library's
// fireEvent.pointerDown/Move/Cancel falls back to a plain Event and silently
// drops pointerId/clientX/clientY (they arrive as undefined in handlers).
// This minimal polyfill (MouseEvent already carries the coordinates in jsdom;
// we only add pointerId) makes pointer-gesture assertions real instead of
// vacuous. Scoped to this file via the same `??` guard style as setup.ts.
class PointerEventPolyfill extends MouseEvent {
  pointerId: number
  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props)
    this.pointerId = props.pointerId ?? 0
  }
}
globalThis.PointerEvent =
  globalThis.PointerEvent ?? (PointerEventPolyfill as unknown as typeof PointerEvent)

const DIAGRAM = (
  <svg data-testid="diagram-svg">
    <circle r="1" />
  </svg>
)

function getTransformHost() {
  return screen.getByTestId('diagram-svg').parentElement as HTMLElement
}

/** jsdom reports every box as 0x0, so a measured fit() has nothing to measure.
 *  Stub the layout boxes to exercise the real scale computation. */
function stubBoxes(surface: HTMLElement, content: HTMLElement, dims: Record<string, number>) {
  const define = (el: HTMLElement, prop: string, value: number) =>
    Object.defineProperty(el, prop, { configurable: true, value })
  define(surface, 'clientWidth', dims.surfaceW!)
  define(surface, 'clientHeight', dims.surfaceH!)
  define(content, 'offsetWidth', dims.contentW!)
  define(content, 'offsetHeight', dims.contentH!)
}

describe('useViewer', () => {
  it('starts empty, opens with an owner key and a node, and clears on close', () => {
    const { result } = renderHook(() => useViewer())
    expect(result.current.content).toBeNull()

    act(() => result.current.open('block-1', DIAGRAM))
    expect(result.current.content?.ownerKey).toBe('block-1')
    expect(result.current.content?.node).toBe(DIAGRAM)

    act(() => result.current.close())
    expect(result.current.content).toBeNull()
  })

  it('sync refreshes the expanded node for the owning block, so an interactive diagram does not freeze', () => {
    const { result } = renderHook(() => useViewer())
    const next = <svg data-testid="step-2" />

    act(() => result.current.open('block-1', DIAGRAM))
    act(() => result.current.sync('block-1', next))

    expect(result.current.content?.node).toBe(next)
  })

  it('sync from a block that does not own the viewer is ignored', () => {
    const { result } = renderHook(() => useViewer())

    act(() => result.current.open('block-1', DIAGRAM))
    act(() => result.current.sync('block-2', <svg data-testid="intruder" />))

    expect(result.current.content?.ownerKey).toBe('block-1')
    expect(result.current.content?.node).toBe(DIAGRAM)
  })
})

describe('ViewerOverlay', () => {
  it('renders nothing when content is null', () => {
    render(<ViewerOverlay content={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a dialog with the live node when open', () => {
    render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: /diagram viewer/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByTestId('diagram-svg')).toBeInTheDocument()
  })

  it('exposes toolbar buttons inside the dialog subtree with accessible names and a 44px hit floor', () => {
    render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)

    // The toolbar must live inside the role="dialog" element, otherwise
    // aria-modal hides it (Close included) from assistive tech.
    const dialog = screen.getByRole('dialog', { name: /diagram viewer/i })
    for (const name of ['Zoom out', 'Zoom in', 'Fit to screen', 'Close viewer']) {
      const button = within(dialog).getByRole('button', { name })
      expect(button.className).toContain('min-h-11')
      expect(button.className).toContain('min-w-11')
    }
  })

  it('zooms in and out via the toolbar buttons, changing the transform scale', () => {
    render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)

    const host = getTransformHost()
    expect(host.style.transform).toContain('scale(1)')

    act(() => screen.getByRole('button', { name: 'Zoom in' }).click())
    const zoomedIn = host.style.transform.match(/scale\(([\d.]+)\)/)
    expect(Number(zoomedIn?.[1])).toBeGreaterThan(1)

    act(() => screen.getByRole('button', { name: 'Zoom out' }).click())
    act(() => screen.getByRole('button', { name: 'Zoom out' }).click())
    const zoomedOut = host.style.transform.match(/scale\(([\d.]+)\)/)
    expect(Number(zoomedOut?.[1])).toBeLessThan(1)
  })

  it('Fit scales the content to fill the surface, not merely back to 1', () => {
    render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)

    const content = getTransformHost()
    const surface = content.parentElement as HTMLElement
    // A 400x200 diagram in an 800x800 surface fits at 2x (limited by width).
    stubBoxes(surface, content, { surfaceW: 800, surfaceH: 800, contentW: 400, contentH: 200 })

    act(() => screen.getByRole('button', { name: 'Fit to screen' }).click())
    expect(content.style.transform).toBe('translate(0px, 0px) scale(2)')
  })

  it('Fit falls back to a plain reset when the boxes measure zero', () => {
    render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)

    const host = getTransformHost()
    act(() => screen.getByRole('button', { name: 'Zoom in' }).click())
    expect(host.style.transform).not.toContain('scale(1)')

    // Boxes are 0x0 in jsdom: a naive fit would divide by zero.
    act(() => screen.getByRole('button', { name: 'Fit to screen' }).click())
    expect(host.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('calls onClose when the Close button is clicked', () => {
    const onClose = vi.fn()
    render(<ViewerOverlay content={DIAGRAM} onClose={onClose} />)

    act(() => screen.getByRole('button', { name: 'Close viewer' }).click())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<ViewerOverlay content={DIAGRAM} onClose={onClose} />)

    act(() => {
      screen
        .getByRole('dialog')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the dialog on open and restores it to the previously focused element on close', () => {
    const outsideButton = document.createElement('button')
    outsideButton.textContent = 'outside'
    document.body.appendChild(outsideButton)
    outsideButton.focus()
    expect(document.activeElement).toBe(outsideButton)

    const { rerender } = render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toHaveFocus()

    rerender(<ViewerOverlay content={null} onClose={vi.fn()} />)
    expect(document.activeElement).toBe(outsideButton)
    document.body.removeChild(outsideButton)
  })

  it('zooms on a bare wheel via a non-passive native listener', () => {
    render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)

    const host = getTransformHost()
    act(() => {
      fireEvent.wheel(host.parentElement as HTMLElement, { deltaY: -100 })
    })

    const match = host.style.transform.match(/scale\(([\d.]+)\)/)
    expect(Number(match?.[1])).toBeGreaterThan(1)
  })

  it('ignores pointerdown on the toolbar so dragging a toolbar button does not start a pan', () => {
    render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)

    const host = getTransformHost()
    act(() => {
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Zoom in' }), {
        pointerId: 1,
        clientX: 10,
        clientY: 10,
      })
    })

    expect(host.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('clears a cancelled pointer so a later single-pointer drag pans instead of pinching', () => {
    render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)

    const host = getTransformHost()
    const surface = host.parentElement as HTMLElement

    // Two pointers down = pinch tracking; then the second is cancelled by the
    // OS (palm rejection, system gesture) instead of lifted.
    act(() => {
      fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 100 })
      fireEvent.pointerDown(surface, { pointerId: 2, clientX: 200, clientY: 200 })
      fireEvent.pointerCancel(surface, { pointerId: 2, clientX: 200, clientY: 200 })
    })

    // The surviving pointer drags: this must pan (translate), not pinch (scale).
    act(() => {
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: 130, clientY: 150 })
    })

    expect(host.style.transform).toBe('translate(30px, 50px) scale(1)')
  })

  it('resets pan and zoom when reopened after a close', () => {
    const { rerender } = render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)

    const host = getTransformHost()
    const surface = host.parentElement as HTMLElement
    act(() => screen.getByRole('button', { name: 'Zoom in' }).click())
    act(() => {
      fireEvent.pointerDown(surface, { pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: 40, clientY: 40 })
    })
    expect(host.style.transform).not.toBe('translate(0px, 0px) scale(1)')

    rerender(<ViewerOverlay content={null} onClose={vi.fn()} />)
    rerender(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)

    expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('takes every gesture: the overlay owns the screen, so touch-action is none', () => {
    render(<ViewerOverlay content={DIAGRAM} onClose={vi.fn()} />)
    const surface = getTransformHost().parentElement as HTMLElement
    expect(surface.style.touchAction).toBe('none')
  })
})
