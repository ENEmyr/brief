import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PanZoomSurface, usePanZoom } from '@/features/diagram-viewer'

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

function Surface() {
  const api = usePanZoom()
  return (
    <div>
      <button type="button" onClick={api.zoomIn}>
        Zoom in
      </button>
      <button type="button" onClick={api.zoomOut}>
        Zoom out
      </button>
      <button type="button" onClick={api.reset}>
        Reset
      </button>
      <PanZoomSurface api={api}>
        <svg data-testid="diagram" />
      </PanZoomSurface>
    </div>
  )
}

const getTransformHost = () => screen.getByTestId('diagram').parentElement as HTMLElement
const getBody = () => getTransformHost().parentElement as HTMLElement
const press = (name: string, times = 1) => {
  for (let i = 0; i < times; i++) act(() => screen.getByRole('button', { name }).click())
}

// These five tests pinned usePanZoom('inline'), the in-page mode DiagramCard
// used. The block card removed its last caller and Phase 4b removed the mode,
// so each now pins the overlay contract the viewer ships (B-Overlays:149-150).
describe('usePanZoom (the fullscreen viewer)', () => {
  it('steps the zoom buttons by 25 points (B-Overlays:229-230)', () => {
    render(<Surface />)
    press('Zoom in')
    expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(1.25)')
    press('Zoom out', 2)
    expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(0.75)')
  })

  it('pans with one pointer at rest, since the viewer owns the screen', () => {
    render(<Surface />)
    act(() => {
      fireEvent.pointerDown(getBody(), { pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerMove(getBody(), { pointerId: 1, clientX: 60, clientY: 20 })
    })
    expect(getTransformHost().style.transform).toBe('translate(60px, 20px) scale(1)')
  })

  it('clamps the zoom to 30% and 600% (usePanZoom MIN_ZOOM, MAX_ZOOM)', () => {
    render(<Surface />)
    press('Zoom out', 6)
    expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(0.3)')
    press('Zoom in', 30)
    expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(6)')
  })

  it('reset returns to 100% and forgets a gesture left unfinished (bug-121)', () => {
    render(<Surface />)
    press('Zoom in')
    act(() => {
      fireEvent.pointerDown(getBody(), { pointerId: 1, clientX: 0, clientY: 0 })
    })
    press('Reset')
    expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(1)')

    // Without the reset dropping pointer 1, this second pointer would start a pinch.
    act(() => {
      fireEvent.pointerDown(getBody(), { pointerId: 2, clientX: 100, clientY: 100 })
      fireEvent.pointerMove(getBody(), { pointerId: 2, clientX: 130, clientY: 140 })
    })
    expect(getTransformHost().style.transform).toBe('translate(30px, 40px) scale(1)')
  })

  it('zooms on a bare wheel and snaps the next button press back onto the 25-point grid', () => {
    render(<Surface />)
    act(() => {
      fireEvent.wheel(getBody(), { deltaY: -100 })
    })
    expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(1.15)')
    press('Zoom in')
    expect(getTransformHost().style.transform).toBe('translate(0px, 0px) scale(1.25)')
  })
})
