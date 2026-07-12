import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import type { Block } from '@brief/schema'

const layersBlock: Extract<Block, { type: 'layers' }> = {
  type: 'layers',
  title: 'Request path',
  layers: [
    {
      id: 'flow',
      label: 'Request flow',
      nodes: [
        { id: 'client', label: 'Client' },
        { id: 'limiter', label: 'Limiter' },
        { id: 'api', label: 'API' },
      ],
      edges: [
        { from: 'client', to: 'limiter', label: 'request' },
        { from: 'limiter', to: 'api', label: 'forward' },
      ],
    },
    {
      id: 'cache',
      label: 'Redis cache',
      nodes: [{ id: 'redis', label: 'Redis' }],
      edges: [{ from: 'redis', to: 'limiter' }],
    },
    {
      id: 'retry',
      label: 'Retry queue',
      nodes: [{ id: 'retryq', label: 'Retry queue' }],
      edges: [{ from: 'api', to: 'retryq' }],
    },
  ],
}

const erdBlock: Extract<Block, { type: 'erd' }> = {
  type: 'erd',
  title: 'Schema',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'email', type: 'text' },
      ],
    },
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'user_id', type: 'uuid', fk: { table: 'users', column: 'id' } },
        { name: 'ghost_id', type: 'uuid', fk: { table: 'nonexistent', column: 'id' } },
      ],
    },
  ],
}

const r = (block: Block) => render(<BlockRenderer block={block} />)

function findAncestorWithText(container: HTMLElement, text: string): Element | null {
  const textEl = Array.from(container.querySelectorAll('text')).find((t) => t.textContent === text)
  return textEl?.closest('g') ?? null
}

describe('Layers block', () => {
  it('renders the diagram caption from block.title, falling back to "Layers"', () => {
    r(layersBlock)
    expect(screen.getByText('Request path')).toBeInTheDocument()
    const untitled = { ...layersBlock }
    delete untitled.title
    r(untitled)
    expect(screen.getByText('Layers')).toBeInTheDocument()
  })

  it('renders the base layer chip as always-on and non-clickable', () => {
    r(layersBlock)
    const baseChip = screen.getByRole('button', { name: '[x] Request flow' })
    expect(baseChip).toBeDisabled()
  })

  it('renders additional layer chips off by default and clickable', () => {
    r(layersBlock)
    const cacheChip = screen.getByRole('button', { name: '[ ] Redis cache' })
    const retryChip = screen.getByRole('button', { name: '[ ] Retry queue' })
    expect(cacheChip).not.toBeDisabled()
    expect(retryChip).not.toBeDisabled()
  })

  it('base layer nodes and edges are always fully visible', () => {
    const { container } = r(layersBlock)
    const clientGroup = findAncestorWithText(container, 'Client')
    expect(clientGroup?.getAttribute('style')).toContain('opacity: 1')
  })

  it('hides non-base layer nodes and edges by default (low opacity)', () => {
    const { container } = r(layersBlock)
    const redisGroup = findAncestorWithText(container, 'Redis')
    expect(redisGroup?.getAttribute('style')).toContain('opacity: 0.14')
  })

  it('toggling a layer chip flips its node and edge opacity', () => {
    const { container } = r(layersBlock)
    const cacheChip = screen.getByRole('button', { name: '[ ] Redis cache' })
    // Edge order follows layer order: [0]=client->limiter, [1]=limiter->api
    // (both base, always on), [2]=redis->limiter (owned by the cache layer).
    const edgeGroupsBefore = container.querySelectorAll('svg > g')
    expect(edgeGroupsBefore[2]?.getAttribute('style')).toContain('opacity: 0.12')
    fireEvent.click(cacheChip)
    expect(screen.getByRole('button', { name: '[x] Redis cache' })).toBeInTheDocument()
    const redisGroup = findAncestorWithText(container, 'Redis')
    expect(redisGroup?.getAttribute('style')).toContain('opacity: 1')
    const edgeGroupsAfter = container.querySelectorAll('svg > g')
    expect(edgeGroupsAfter[2]?.getAttribute('style')).toContain('opacity: 0.8')
  })

  it('clicking the base chip does nothing (stays on, no crash)', () => {
    r(layersBlock)
    const baseChip = screen.getByRole('button', { name: '[x] Request flow' })
    fireEvent.click(baseChip)
    expect(screen.getByRole('button', { name: '[x] Request flow' })).toBeInTheDocument()
  })

  it('strokes edge lines, edge labels, and the arrow marker with the real --ctp-subtext0 token (--ctp-sub does not exist)', () => {
    const { container } = r(layersBlock)
    const svg = container.querySelector('svg')
    // Regression for the invisible-edges bug: an unresolved CSS var (the
    // nonexistent --ctp-sub) collapses SVG stroke to none in a browser,
    // while jsdom renders the raw string either way. Assert the literal
    // token name so the bug cannot silently return.
    const edgeLines = Array.from(svg?.querySelectorAll('g > line') ?? [])
    expect(edgeLines.length).toBeGreaterThan(0)
    edgeLines.forEach((l) => expect(l.getAttribute('style')).toContain('var(--ctp-subtext0)'))
    const edgeLabel = Array.from(svg?.querySelectorAll('g > text') ?? []).find((t) => t.textContent === 'request')
    expect(edgeLabel?.getAttribute('style')).toContain('var(--ctp-subtext0)')
    const markerPath = svg?.querySelector('marker path')
    expect(markerPath?.getAttribute('style')).toContain('var(--ctp-subtext0)')
    expect(svg?.innerHTML).not.toContain('var(--ctp-sub)')
  })

  it('renders a node id repeated across two layers exactly once, keeping the first-seen layer position and color', () => {
    const block: Extract<Block, { type: 'layers' }> = {
      type: 'layers',
      layers: [
        {
          id: 'base',
          label: 'Base',
          nodes: [{ id: 'shared', label: 'Shared' }],
          edges: [],
        },
        {
          id: 'extra',
          label: 'Extra',
          nodes: [
            { id: 'shared', label: 'Shared duplicate' },
            { id: 'other', label: 'Other' },
          ],
          edges: [{ from: 'other', to: 'shared' }],
        },
      ],
    }
    const { container } = r(block)
    // First-seen layer wins: exactly one node for the duplicate id, with the
    // base layer's label, position (base row y=58), and color (blue).
    expect(screen.getAllByText('Shared').length).toBe(1)
    expect(screen.queryByText('Shared duplicate')).not.toBeInTheDocument()
    const sharedGroup = findAncestorWithText(container, 'Shared')
    const sharedRect = sharedGroup?.querySelector('rect')
    expect(sharedRect?.getAttribute('y')).toBe('58')
    expect(sharedRect?.getAttribute('style')).toContain('var(--ctp-blue)')
    // The base-layer-owned node stays fully visible even though the extra
    // layer (off by default) also declared it.
    expect(sharedGroup?.getAttribute('style')).toContain('opacity: 1')
  })

  it('skips edges referencing unknown node ids instead of crashing', () => {
    const block: Extract<Block, { type: 'layers' }> = {
      type: 'layers',
      layers: [
        {
          id: 'flow',
          label: 'Flow',
          nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
          edges: [
            { from: 'a', to: 'b', label: 'ok' },
            { from: 'a', to: 'ghost', label: 'bad' },
          ],
        },
      ],
    }
    expect(() => r(block)).not.toThrow()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.queryByText('bad')).not.toBeInTheDocument()
  })
})

describe('Erd block', () => {
  it('renders the diagram caption from block.title, falling back to "Entity relationship"', () => {
    r(erdBlock)
    expect(screen.getByText('Schema')).toBeInTheDocument()
    const untitled = { ...erdBlock }
    delete untitled.title
    r(untitled)
    expect(screen.getByText('Entity relationship')).toBeInTheDocument()
  })

  it('renders a table header per table', () => {
    r(erdBlock)
    expect(screen.getByText('users')).toBeInTheDocument()
    expect(screen.getByText('orders')).toBeInTheDocument()
  })

  it('renders a bold "PK " text prefix for primary key columns', () => {
    const { container } = r(erdBlock)
    const pkTspans = Array.from(container.querySelectorAll('tspan')).filter((t) => t.textContent === 'PK ')
    // one per table's id column (users.id, orders.id)
    expect(pkTspans.length).toBe(2)
    pkTspans.forEach((t) => {
      expect(t.getAttribute('font-weight')).toBe('700')
      expect(t.getAttribute('text-decoration')).toBe('underline')
    })
  })

  it('renders a teal " FK" text suffix for foreign key columns', () => {
    const { container } = r(erdBlock)
    const fkTspans = Array.from(container.querySelectorAll('tspan')).filter((t) => t.textContent === ' FK')
    // both user_id -> users and ghost_id -> nonexistent are still marked FK in the column row
    expect(fkTspans.length).toBe(2)
  })

  it('renders exactly one fk edge per valid fk reference, skipping unknown table refs', () => {
    const { container } = r(erdBlock)
    const svg = container.querySelector('svg')
    // Edges are orthogonal paths, not straight lines: an edge now picks which
    // side of each box to leave from and arrive at, so it needs elbows.
    const dashedTealEdges = Array.from(svg?.querySelectorAll('path') ?? []).filter(
      (p) => p.getAttribute('stroke-dasharray') === '4 3',
    )
    // only user_id -> users is a resolvable table; ghost_id -> nonexistent is skipped
    expect(dashedTealEdges.length).toBe(1)
  })

  it('routes an fk edge orthogonally, standing off the box before it turns', () => {
    const { container } = r(erdBlock)
    const edge = Array.from(container.querySelectorAll('path')).find(
      (p) => p.getAttribute('stroke-dasharray') === '4 3',
    )
    // M x,y H mid V y2 H x2: horizontal out, vertical across, horizontal in.
    expect(edge?.getAttribute('d')).toMatch(/^M[\d.-]+,[\d.-]+ H[\d.-]+ V[\d.-]+ H[\d.-]+$/)
  })

  it('does not crash when a fk references an unknown table', () => {
    expect(() => r(erdBlock)).not.toThrow()
  })
})
