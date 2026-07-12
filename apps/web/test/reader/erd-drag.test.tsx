import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { Erd } from '@/features/reader/components/blocks/Erd'
import { DiagramLayoutProvider, loadLayout } from '@/features/diagram-layout'

class PointerEventPolyfill extends MouseEvent {
  pointerId: number
  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props)
    this.pointerId = props.pointerId ?? 0
  }
}
globalThis.PointerEvent =
  globalThis.PointerEvent ?? (PointerEventPolyfill as unknown as typeof PointerEvent)

const erdBlock: Extract<Block, { type: 'erd' }> = {
  type: 'erd',
  tables: [
    { name: 'users', columns: [{ name: 'id', type: 'uuid', pk: true }] },
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'user_id', type: 'uuid', fk: { table: 'users', column: 'id' } },
      ],
    },
  ],
}

const SESSION = 'erd-drag-test'

function renderErd() {
  return render(
    <DiagramLayoutProvider sessionId={SESSION}>
      <Erd block={erdBlock} sid={0} bid={1} />
    </DiagramLayoutProvider>,
  )
}

const tableGroup = (container: HTMLElement, name: string) =>
  container.querySelector(`g[data-table="${name}"]`) as SVGGElement
const headerRect = (container: HTMLElement, name: string) =>
  tableGroup(container, name).querySelector('rect') as SVGRectElement

function drag(el: Element, dx: number, dy: number) {
  act(() => {
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: dx, clientY: dy })
    fireEvent.pointerUp(el, { pointerId: 1, clientX: dx, clientY: dy })
  })
}

afterEach(() => localStorage.clear())

describe('Erd drag-to-rearrange', () => {
  it('moves a table by the drag delta', () => {
    const { container } = renderErd()
    const before = Number(headerRect(container, 'orders').getAttribute('x'))

    drag(tableGroup(container, 'orders'), 40, 25)

    const after = Number(headerRect(container, 'orders').getAttribute('x'))
    // jsdom reports a zero-width svg, so units-per-pixel falls back to 1:1.
    expect(after).toBe(before + 40)
  })

  it('persists the offset to localStorage, not to the synced reader state', () => {
    const { container } = renderErd()
    drag(tableGroup(container, 'orders'), 40, 25)

    // Layout lives under its own key. Reader state (highlights, answers) is a
    // shared last-writer-wins blob; a drag must never write into it.
    expect(loadLayout(SESSION)).toEqual({ '0:1': { orders: { dx: 40, dy: 25 } } })
    expect(localStorage.getItem(`idocs:${SESSION}`)).toBeNull()
  })

  it('stores an offset from auto-layout, so a reflowed diagram still honours the drag', () => {
    const { container } = renderErd()
    drag(tableGroup(container, 'orders'), 40, 25)

    const stored = loadLayout(SESSION)['0:1']?.orders
    // A delta, not an absolute coordinate: auto-layout puts `orders` well past
    // x=40, so a stored absolute would be much larger than the drag distance.
    expect(stored).toEqual({ dx: 40, dy: 25 })
  })

  it('restores a persisted offset on a later render', () => {
    const first = renderErd()
    drag(tableGroup(first.container, 'orders'), 40, 25)
    const moved = Number(headerRect(first.container, 'orders').getAttribute('x'))
    first.unmount()

    const second = renderErd()
    expect(Number(headerRect(second.container, 'orders').getAttribute('x'))).toBe(moved)
  })

  it('offers Reset layout only once something has been moved, and it restores the auto-layout', () => {
    const { container } = renderErd()
    const original = Number(headerRect(container, 'orders').getAttribute('x'))
    expect(screen.queryByRole('button', { name: 'Reset layout' })).not.toBeInTheDocument()

    drag(tableGroup(container, 'orders'), 40, 25)
    expect(Number(headerRect(container, 'orders').getAttribute('x'))).not.toBe(original)

    act(() => screen.getByRole('button', { name: 'Reset layout' }).click())

    expect(Number(headerRect(container, 'orders').getAttribute('x'))).toBe(original)
    expect(loadLayout(SESSION)['0:1']).toBeUndefined()
  })

  it('ignores a stored offset for a table the payload no longer has', () => {
    localStorage.setItem(
      `idocs:layout:${SESSION}`,
      JSON.stringify({ '0:1': { ghost_table: { dx: 99, dy: 99 } } }),
    )
    const { container } = renderErd()

    // The ghost has no box to move, so nothing is "moved" and no Reset appears.
    expect(screen.queryByRole('button', { name: 'Reset layout' })).not.toBeInTheDocument()
    expect(tableGroup(container, 'users')).toBeInTheDocument()
  })

  it('survives a corrupt stored layout', () => {
    localStorage.setItem(`idocs:layout:${SESSION}`, '{not json')
    expect(() => renderErd()).not.toThrow()
  })
})
