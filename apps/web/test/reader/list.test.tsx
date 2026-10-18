import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { BlockRenderer } from '@/features/reader'
import { ReaderStateProvider } from '@/features/reader-state'

const XSS = '<img src=x onerror="window.__xss=1">'

function renderBlock(block: Block, anchor: { bid?: number } = { bid: 3 }) {
  return render(
    <ReaderStateProvider sessionId="list-test">
      <BlockRenderer block={block} sid={1} bid={anchor.bid} />
    </ReaderStateProvider>,
  )
}

describe('list block', () => {
  it('draws a bulleted list in a card, one annotatable leaf per item', () => {
    const { container } = renderBlock({ type: 'list', items: ['Burst webhooks hit 429', 'Fail open or closed'] })
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('UL')
    expect(container.querySelector('figure [data-kind-tag]')?.textContent).toBe('list')
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['Burst webhooks hit 429', 'Fail open or closed'])
    expect(items.map((li) => li.getAttribute('data-path'))).toEqual(['items.0', 'items.1'])
    expect(items.map((li) => [li.getAttribute('data-sid'), li.getAttribute('data-bid')])).toEqual([
      ['1', '3'],
      ['1', '3'],
    ])
  })

  it('numbers an ordered list and shows its caption as an annotatable header', () => {
    renderBlock({ type: 'list', ordered: true, caption: 'Rollout', items: ['Schema', 'Reader'] })
    expect(screen.getByRole('list').tagName).toBe('OL')
    expect(screen.getByText('Rollout').closest('[data-path]')).toHaveAttribute('data-path', 'caption')
  })

  it('addresses items under the details prefix when nested', () => {
    renderBlock({ type: 'details', summary: 'more', blocks: [{ type: 'list', items: ['inner'] }] })
    expect(screen.getByText('inner')).toHaveAttribute('data-path', 'blocks.0.items.0')
  })

  it('renders plain items when the block has no index', () => {
    renderBlock({ type: 'list', items: ['plain'] }, {})
    expect(screen.getByText('plain')).not.toHaveAttribute('data-hl')
  })

  it('prints markup in caption and items as text', () => {
    const { container } = renderBlock({ type: 'list', caption: XSS, items: [XSS] })
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getAllByText(XSS)).toHaveLength(2)
  })
})
