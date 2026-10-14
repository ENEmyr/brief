import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { Erd } from '@/features/reader/components/blocks/Erd'

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

const renderErd = () => render(<Erd block={erdBlock} sid={0} bid={1} />)
const table = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-table="${name}"]`) as HTMLElement
const row = (container: HTMLElement, tableName: string, column: string) =>
  table(container, tableName).querySelector<HTMLElement>(`[data-column="${column}"]`) as HTMLElement

function drag(el: Element, dx: number, dy: number) {
  act(() => {
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: dx, clientY: dy })
    fireEvent.pointerUp(el, { pointerId: 1, clientX: dx, clientY: dy })
  })
}

afterEach(() => localStorage.clear())

// These tests pinned table dragging and its per-browser layout store. Owner
// ruling D5 removed both (B-Blocks2:80-94 draws no drag and no Reset layout,
// and asks for FK hover instead), so each now pins what replaced it.
describe('Erd: fixed layout and FK hover', () => {
  it('leaves a dragged table where the layout put it', () => {
    const { container } = renderErd()
    const before = table(container, 'orders').style.left
    drag(table(container, 'orders'), 40, 25)
    expect(table(container, 'orders').style.left).toBe(before)
  })

  it('writes nothing to localStorage when the reader drags', () => {
    const { container } = renderErd()
    drag(table(container, 'orders'), 40, 25)
    expect(localStorage.length).toBe(0)
  })

  it('highlights the hovered FK row and the row it points at (B-Blocks2:88, :93)', () => {
    const { container } = renderErd()
    act(() => {
      fireEvent.pointerEnter(row(container, 'orders', 'user_id'))
    })
    expect(row(container, 'orders', 'user_id').className).toContain('bg-[var(--c-row-hover)]')
    expect(row(container, 'users', 'id').className).toContain('bg-[var(--c-row-hover)]')
    expect(row(container, 'orders', 'id').className).not.toContain('bg-[var(--c-row-hover)]')
  })

  it('ignores an offset an older reader stored under idocs:layout', () => {
    const fresh = renderErd()
    const auto = table(fresh.container, 'orders').style.left
    fresh.unmount()

    localStorage.setItem(`idocs:layout:${SESSION}`, JSON.stringify({ '0:1': { orders: { dx: 40, dy: 25 } } }))
    const { container } = renderErd()
    expect(table(container, 'orders').style.left).toBe(auto)
  })

  it('never offers Reset layout', () => {
    const { container } = renderErd()
    drag(table(container, 'orders'), 40, 25)
    expect(screen.queryByRole('button', { name: 'Reset layout' })).not.toBeInTheDocument()
  })

  it('turns the hovered connector lime, and leaving the row clears all three', () => {
    const { container } = renderErd()
    const edge = () => container.querySelector('[data-edge]') as SVGGElement
    expect(edge().getAttribute('class')).toContain('stroke-sub')

    act(() => {
      fireEvent.pointerEnter(row(container, 'orders', 'user_id'))
    })
    expect(edge().getAttribute('class')).toContain('stroke-accent-line')

    act(() => {
      fireEvent.pointerLeave(row(container, 'orders', 'user_id'))
    })
    expect(edge().getAttribute('class')).toContain('stroke-sub')
    expect(row(container, 'users', 'id').className).not.toContain('bg-[var(--c-row-hover)]')
  })

  it('survives a corrupt layout an older reader left in storage', () => {
    localStorage.setItem(`idocs:layout:${SESSION}`, '{not json')
    expect(() => renderErd()).not.toThrow()
  })
})
