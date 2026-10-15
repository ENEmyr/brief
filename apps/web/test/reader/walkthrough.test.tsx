import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import { ReaderStateProvider } from '@/features/reader-state'
import type { WalkthroughBlock } from '@brief/schema'
import { walkthroughModel } from '@/features/reader/lib/walkthroughModel'

vi.mock('@/features/reader/services/shiki', () => ({
  highlightToHast: () => new Promise(() => {}),
}))

const LIMITER: WalkthroughBlock = {
  type: 'walkthrough',
  language: 'ts',
  filename: 'src/limiter.ts',
  title: 'handle()',
  code: 'export async function handle(req, env) {\n  const key = resolveKey(req)\n  const { success } = await env.LIMITER.limit({ key })\n  if (!success) return tooMany(30)\n  return fetch(origin(req))\n}',
  flow: {
    nodes: [
      { id: 'req', label: 'Request in', kind: 'start' },
      { id: 'key', label: 'Find the key' },
      { id: 'ok', label: 'Token left?', kind: 'decision' },
      { id: 'deny', label: 'Reply 429', kind: 'end' },
      { id: 'fwd', label: 'Forward to origin', kind: 'end' },
    ],
    edges: [
      { from: 'req', to: 'key' },
      { from: 'key', to: 'ok' },
      { from: 'ok', to: 'deny', label: 'no' },
      { from: 'ok', to: 'fwd', label: 'yes' },
    ],
  },
  steps: [
    { from: 1, to: 2, title: 'Take the request and find the key', nodes: ['req', 'key'] },
    { from: 3, title: 'Ask for one token', nodes: ['ok'] },
    { from: 4, title: 'Out of tokens, reply 429', nodes: ['deny'] },
    { from: 5, to: 6, title: 'Passed, forward to origin', nodes: ['fwd'] },
  ],
}

describe('walkthroughModel', () => {
  it('groups the listing into one run per step, each closed by its caption', () => {
    const m = walkthroughModel(LIMITER)
    expect(m.segments).toEqual([
      { owner: 0, start: 0, end: 2, captions: [0] },
      { owner: 1, start: 2, end: 3, captions: [1] },
      { owner: 2, start: 3, end: 4, captions: [2] },
      { owner: 3, start: 4, end: 6, captions: [3] },
    ])
    expect(m.unplaced).toEqual([])
  })

  it('keeps unclaimed lines plain, gives an overlapped line to the first step, and parks a step past the end', () => {
    const m = walkthroughModel({
      ...LIMITER,
      steps: [
        { from: 2, to: 3, title: 'a', nodes: ['req'] },
        { from: 3, to: 4, title: 'b', nodes: ['key'] },
        { from: 3, title: 'c', nodes: ['ok'] },
        { from: 99, title: 'd', nodes: ['deny'] },
      ],
    })
    expect(m.segments).toEqual([
      { owner: null, start: 0, end: 1, captions: [] },
      { owner: 0, start: 1, end: 3, captions: [0] },
      { owner: 1, start: 3, end: 4, captions: [1] },
      { owner: null, start: 4, end: 6, captions: [] },
    ])
    expect(m.unplaced).toEqual([2, 3])
  })

  it('reveals nodes cumulatively and drops ids and edges the flow lacks', () => {
    const m = walkthroughModel({
      ...LIMITER,
      flow: { ...LIMITER.flow, edges: [...LIMITER.flow.edges, { from: 'ok', to: 'ghost' }] },
      steps: [
        { from: 1, title: 'a', nodes: ['req', 'ghost'] },
        { from: 2, title: 'b', nodes: ['key'] },
      ],
    })
    expect(m.revealed.map((s) => [...s])).toEqual([['req'], ['req', 'key']])
    expect(m.edges.map((e) => `${e.from}>${e.to}`)).toEqual(['req>key', 'key>ok', 'ok>deny', 'ok>fwd'])
  })

  it('runs the main path down one column and opens a side column for the other branch', () => {
    const m = walkthroughModel(LIMITER)
    const at = (id: string) => {
      const b = m.boxes.get(id)!
      return [b.x, b.y, b.w, b.h]
    }
    expect(at('req')).toEqual([24, 24, 220, 48])
    expect(at('key')).toEqual([24, 112, 220, 56])
    expect(at('ok')).toEqual([34, 208, 200, 96])
    expect(at('deny')).toEqual([324, 232, 220, 48])
    expect(at('fwd')).toEqual([24, 368, 220, 48])
  })
})

function renderBlock(block: WalkthroughBlock) {
  return render(
    <ReaderStateProvider sessionId="walkthrough-test">
      <BlockRenderer block={block} sid={0} bid={0} />
    </ReaderStateProvider>,
  )
}

const nodes = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-node]')].map((n) => n.getAttribute('data-node'))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('Walkthrough', () => {
  it('shows "filename / title", the first hunk and the flow up to it', () => {
    const { container } = renderBlock(LIMITER)
    const header = container.querySelector('figure > div')!
    expect(header.textContent).toBe('walkthroughsrc/limiter.ts / handle()hunk 1 / 4')
    expect(screen.getByRole('button', { name: '01 Take the request and find the key' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(nodes(container)).toEqual(['req', 'key'])
    expect(screen.getByRole('button', { name: 'Previous hunk' })).toBeDisabled()
  })

  it('a step draws the flow up to it and marks its nodes current', () => {
    const { container } = renderBlock(LIMITER)
    fireEvent.click(screen.getByRole('button', { name: '03 Out of tokens, reply 429' }))
    expect(screen.getByText('hunk 3 / 4')).toBeInTheDocument()
    expect(nodes(container)).toEqual(['req', 'key', 'ok', 'deny'])
    expect(container.querySelector('[data-current]')?.getAttribute('data-node')).toBe('deny')
    expect(screen.getByRole('button', { name: '01 Take the request and find the key' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('Next and Previous move one hunk and stop at the ends', () => {
    const { container } = renderBlock(LIMITER)
    const next = screen.getByRole('button', { name: 'Next hunk' })
    for (let i = 0; i < 5; i += 1) fireEvent.click(next)
    expect(screen.getByText('hunk 4 / 4')).toBeInTheDocument()
    expect(next).toBeDisabled()
    expect(nodes(container)).toEqual(['req', 'key', 'ok', 'deny', 'fwd'])
    fireEvent.click(screen.getByRole('button', { name: 'Previous hunk' }))
    expect(screen.getByText('hunk 3 / 4')).toBeInTheDocument()
  })

  it('clicking a hunk row picks its step, and the rows stay annotatable leaves', () => {
    const { container } = renderBlock(LIMITER)
    const row = container.querySelector('[data-path="code.3"]')!
    expect(row.textContent).toBe('  if (!success) return tooMany(30)')
    fireEvent.click(row)
    expect(screen.getByText('hunk 3 / 4')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-hl][data-path^="code."]')).toHaveLength(6)
  })

  it('renders an injected label as text', () => {
    const xss = '<img src=x onerror="window.__xss=1">'
    const { container } = renderBlock({
      ...LIMITER,
      title: xss,
      flow: {
        nodes: LIMITER.flow.nodes.map((n) => (n.id === 'req' ? { ...n, label: xss } : n)),
        edges: [{ from: 'req', to: 'key', label: xss }],
      },
      steps: [{ from: 1, title: xss, nodes: ['req', 'key'] }],
    })
    expect(container.querySelector('img')).toBeNull()
    expect(within(container.querySelector('[data-flow]') as HTMLElement).getAllByText(xss)).toHaveLength(2)
  })
})
