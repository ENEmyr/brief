import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PanZoomSurface, ZoomControls, usePanZoom } from '@/features/diagram-viewer'

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

function InlineSurface() {
  const api = usePanZoom('inline')
  return (
    <div>
      <ZoomControls api={api} buttonClassName="" action="reset" />
      <PanZoomSurface api={api}>
        <svg data-testid="diagram" />
      </PanZoomSurface>
    </div>
  )
}

const getTransformHost = () => screen.getByTestId('diagram').parentElement as HTMLElement
const getBody = () => getTransformHost().parentElement as HTMLElement

describe('usePanZoom inline gesture contract (a surface inside a scrolling document)', () => {
  it('never captures one-finger touch, so a swipe over a diagram still scrolls the page', () => {
    render(<InlineSurface />)
    expect(getBody().style.touchAction).toBe('pan-y')
  })

  it('does not pan at rest, so a drag near the diagram is not hijacked', () => {
    render(<InlineSurface />)
    act(() => {
      fireEvent.pointerDown(getBody(), { pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerMove(getBody(), { pointerId: 1, clientX: 60, clientY: 20 })
    })
    expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('pans once zoomed in', () => {
    render(<InlineSurface />)
    act(() => screen.getByRole('button', { name: 'Zoom in' }).click())
    act(() => {
      fireEvent.pointerDown(getBody(), { pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerMove(getBody(), { pointerId: 1, clientX: 60, clientY: 20 })
    })
    expect(getTransformHost().style.transform).toContain('translate(60px, 20px)')
  })

  it('Reset returns the inline diagram to 1:1', () => {
    render(<InlineSurface />)
    act(() => screen.getByRole('button', { name: 'Zoom in' }).click())
    expect(getTransformHost().style.transform).not.toContain('scale(1)')

    act(() => screen.getByRole('button', { name: 'Reset zoom' }).click())
    expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('leaves a bare wheel to the page and zooms only on ctrl/cmd+wheel', () => {
    render(<InlineSurface />)
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
