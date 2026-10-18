import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BlockRenderer } from '@/features/reader'
import type { Block } from '@brief/schema'

const GLOBALS_CSS = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
const LAYOUT_TSX = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8')

/** Every custom property the markup reads with var() that neither globals.css
 *  nor next/font (the --font-* variables in app/layout.tsx) declares. */
function undeclaredVars(markup: string): string[] {
  const used = new Set([...markup.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string))
  return [...used].filter((name) => !GLOBALS_CSS.includes(`${name}:`) && !LAYOUT_TSX.includes(`variable: '${name}'`))
}

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

const node = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`[data-layer-node="${id}"]`) as HTMLElement
const edges = (container: HTMLElement) => Array.from(container.querySelectorAll<SVGGElement>('[data-edge]'))

describe('Layers block', () => {
  it('renders the diagram caption from block.title, and only the kind tag without one', () => {
    // The fallback caption 'Layers' is gone: the kind tag names the block
    // (B-Blocks2:52), and an untitled block shows no invented caption.
    r(layersBlock)
    expect(screen.getByText('Request path')).toBeInTheDocument()
    const untitled = { ...layersBlock }
    delete untitled.title
    r(untitled)
    expect(screen.getAllByText('layers')).toHaveLength(2)
    expect(screen.queryByText('Layers')).not.toBeInTheDocument()
  })

  // Owner ruling D5 removed the per-layer toggles: B-Blocks2:51-78 shows every
  // layer at once as a band. The six tests below pinned the chips and the
  // opacity they set; each now pins what the band drawing promises instead.
  it('renders no layer toggles: every layer is a band with its label in caps (B-Blocks2:58-60)', () => {
    const { container } = r(layersBlock)
    expect(screen.queryByRole('button', { name: /Request flow/ })).not.toBeInTheDocument()
    const bands = Array.from(container.querySelectorAll('[data-band]'))
    expect(bands.map((b) => b.textContent)).toEqual(['Request flow', 'Redis cache', 'Retry queue'])
    bands.forEach((b) => expect(b.querySelector('span')?.className).toContain('uppercase'))
  })

  it('stacks the bands 150px apart, 120 tall, in code-bg with a grid-line border', () => {
    const { container } = r(layersBlock)
    const bands = Array.from(container.querySelectorAll<HTMLElement>('[data-band]'))
    expect(bands.map((b) => b.style.top)).toEqual(['0px', '150px', '300px'])
    bands.forEach((b) => {
      expect(b.style.height).toBe('120px')
      expect(b.className).toContain('bg-[var(--c-code-bg)]')
      expect(b.className).toContain('border-[var(--c-grid-line)]')
    })
  })

  it('draws every node fully, the first layer\'s included', () => {
    const { container } = r(layersBlock)
    ;['client', 'limiter', 'api', 'redis', 'retryq'].forEach((id) => {
      expect(node(container, id).className).not.toMatch(/opacity/)
      expect(node(container, id).className).toContain('bg-elev')
      expect(node(container, id).className).toContain('border-line2')
    })
  })

  it('places a node of a later layer in that layer\'s band', () => {
    const { container } = r(layersBlock)
    expect(node(container, 'client').style.top).toBe('34px')
    expect(node(container, 'redis').style.top).toBe('184px')
    expect(node(container, 'retryq').style.top).toBe('334px')
  })

  it('draws one edge per payload edge, in every layer, with no opacity', () => {
    const { container } = r(layersBlock)
    expect(edges(container)).toHaveLength(4)
    edges(container).forEach((e) => expect(e.getAttribute('style')).toBeNull())
  })

  it('routes an edge between bands through the gaps and strips, never across a node', () => {
    const { container } = r(layersBlock)
    // redis (band 1) -> limiter (band 0): up out of redis, across the gap, into limiter.
    const path = edges(container)[2]?.querySelector('path')?.getAttribute('d') ?? ''
    const ys = [...path.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]))
    expect(ys[0]).toBe(184)
    expect(ys).toContain(135)
  })

  it('strokes edges and fills heads with the sub token, and reads no undeclared var', () => {
    // Was the svg line/text/marker `var(--c-sub)` styles. Edges now take the
    // stroke-sub and fill-sub utilities (globals.css --color-sub) and labels
    // are HTML in text-sub; the regression (an unresolved var draws nothing)
    // stays pinned through undeclaredVars.
    const { container } = r(layersBlock)
    edges(container).forEach((e) => expect(e.getAttribute('class')).toContain('stroke-sub fill-sub'))
    expect(screen.getByText('request').className).toContain('text-sub')
    expect(undeclaredVars(container.innerHTML)).toEqual([])
  })

  it('detects a var that globals.css does not declare', () => {
    expect(undeclaredVars('<line style="stroke: var(--c-sub)"/><path style="fill: var(--c-nope)"/>')).toEqual([
      '--c-nope',
    ])
  })

  it('renders a node id repeated across two layers exactly once, keeping the first-seen layer position', () => {
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
    // First-seen layer wins: one node for the duplicate id, with the base
    // layer's label, in the base band (top 34, B-Blocks2:66).
    expect(screen.getAllByText('Shared').length).toBe(1)
    expect(screen.queryByText('Shared duplicate')).not.toBeInTheDocument()
    expect(node(container, 'shared').style.top).toBe('34px')
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
  it('renders the diagram caption from block.title, and only the kind tag without one', () => {
    // The fallback caption 'Entity relationship' is gone: the kind tag names
    // the block (B-Blocks2:81), and an untitled block shows no invented caption.
    r(erdBlock)
    expect(screen.getByText('Schema')).toBeInTheDocument()
    const untitled = { ...erdBlock }
    delete untitled.title
    r(untitled)
    expect(screen.getAllByText('erd')).toHaveLength(2)
    expect(screen.queryByText('Entity relationship')).not.toBeInTheDocument()
  })

  it('renders a table header per table', () => {
    r(erdBlock)
    expect(screen.getByText('users')).toBeInTheDocument()
    expect(screen.getByText('orders')).toBeInTheDocument()
  })

  // The four tests below pinned the old SVG table: underlined "PK " and a teal
  // " FK" tspan, and dashed teal connectors. B-Blocks2:86-90 draws a key
  // column (PK lime, FK cyan) and solid sub connectors with the FK name in
  // cyan; each test now pins that.
  it('marks primary key columns with "PK" in lime (B-Blocks2:86)', () => {
    r(erdBlock)
    const pk = screen.getAllByText('PK')
    // one per table's id column (users.id, orders.id)
    expect(pk).toHaveLength(2)
    pk.forEach((cell) => expect(cell.className).toContain('text-accent-text'))
  })

  it('marks foreign key columns with "FK" in cyan, the unresolvable one included (B-Blocks2:87)', () => {
    r(erdBlock)
    const fk = screen.getAllByText('FK')
    // both user_id -> users and ghost_id -> nonexistent keep their marker
    expect(fk).toHaveLength(2)
    fk.forEach((cell) => expect(cell.className).toContain('text-info'))
  })

  it('renders exactly one fk edge per valid fk reference, skipping unknown table refs', () => {
    const { container } = r(erdBlock)
    expect(container.querySelectorAll('[data-edge]')).toHaveLength(1)
    expect(screen.getByText('user_id', { selector: '.text-info' })).toBeInTheDocument()
  })

  it('runs a neighbour edge straight across at the header line, its head on the target (B-Blocks2:84)', () => {
    const { container } = r(erdBlock)
    const d = container.querySelector('[data-edge] path')?.getAttribute('d') ?? ''
    const points = [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(points).toHaveLength(2)
    // Header line: table top 40 plus half the 36px header.
    expect(points[0]?.[1]).toBe(58)
    expect(points[1]?.[1]).toBe(58)
  })

  it('runs an edge to another row down the gap beside its column, clear of the column\'s widest table', () => {
    // Four tables: three in the first row, the fourth under the first. The
    // first is wide; the fourth is narrow and points at the second.
    const block: Extract<Block, { type: 'erd' }> = {
      type: 'erd',
      tables: [
        { name: 'wide', columns: [{ name: 'a_very_long_column_name_for_width', type: 'timestamptz' }] },
        { name: 'target', columns: [{ name: 'id', type: 'uuid', pk: true }] },
        { name: 'third', columns: [{ name: 'id', type: 'uuid' }] },
        { name: 'narrow', columns: [{ name: 'target_id', type: 'uuid', fk: { table: 'target', column: 'id' } }] },
      ],
    }
    const { container } = r(block)
    const box = (name: string) => container.querySelector<HTMLElement>(`[data-table="${name}"]`)!.style
    const wideRight = Number.parseFloat(box('wide').left) + Number.parseFloat(box('wide').width)
    const d = container.querySelector('[data-edge] path')?.getAttribute('d') ?? ''
    const xs = [...d.matchAll(/[ML]([\d.]+) /g)].map((m) => Number(m[1]))
    // Out of the narrow table, then a vertical run in the gap right of the wide one.
    expect(xs[1]).toBeGreaterThan(wideRight)
    expect(xs[1]).toBeLessThan(Number.parseFloat(box('target').left))
  })

  it('does not crash when a fk references an unknown table', () => {
    expect(() => r(erdBlock)).not.toThrow()
  })
})
