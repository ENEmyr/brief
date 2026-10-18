import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Block } from '@brief/schema'

const r = (block: Block) => render(<BlockRenderer block={block} />)

afterEach(() => vi.unstubAllGlobals())

describe('BlockRenderer text family', () => {
  it('renders p', () => {
    // Paragraph now renders through HighlightedText, which reads reader
    // state via context -- only this 'p' case needs the provider (and its
    // KV-sync fetch stubbed), every other block type in this file is
    // untouched by the annotations feature.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    render(
      <ReaderStateProvider sessionId="blocks-test">
        <BlockRenderer block={{ type: 'p', text: 'hello world' }} sid={0} bid={0} />
      </ReaderStateProvider>,
    )
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('carries the real section/block indices on a top-level p (no default-0 aliasing)', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    render(
      <ReaderStateProvider sessionId="blocks-test-indices">
        <BlockRenderer block={{ type: 'p', text: 'indexed paragraph' }} sid={2} bid={3} />
      </ReaderStateProvider>,
    )
    const p = screen.getByText('indexed paragraph')
    expect(p).toHaveAttribute('data-hl')
    expect(p).toHaveAttribute('data-sid', '2')
    expect(p).toHaveAttribute('data-bid', '3')
  })

  it('renders a p WITHOUT annotation attributes when sid/bid are absent', () => {
    // No default-0: an unindexed p must never alias section 0 / block 0.
    // The plain path also has no HighlightedText, so no provider is needed.
    render(<BlockRenderer block={{ type: 'p', text: 'unindexed paragraph' }} />)
    const p = screen.getByText('unindexed paragraph')
    expect(p).not.toHaveAttribute('data-hl')
    expect(p).not.toHaveAttribute('data-sid')
    expect(p).not.toHaveAttribute('data-bid')
  })

  it('renders warn callout with title', () => {
    r({ type: 'warn', text: 'careful', title: 'Watch out' })
    expect(screen.getByText('Watch out')).toBeInTheDocument()
    expect(screen.getByText('careful')).toBeInTheDocument()
  })

  it('labels each callout with its kind in caps and the status color (B-Blocks:34-36)', () => {
    r({ type: 'note', text: 'n' })
    r({ type: 'warn', text: 'w' })
    r({ type: 'good', text: 'g' })
    expect(screen.getByText('NOTE')).toHaveClass('text-info')
    expect(screen.getByText('WARN')).toHaveClass('text-warn')
    expect(screen.getByText('GOOD')).toHaveClass('text-good')
    expect(screen.getByText('w').closest('aside')?.className).toContain(
      'bg-[var(--c-callout-warn)]',
    )
  })

  it('renders table head and cells, with the caption in the card header', () => {
    r({ type: 'table', head: ['name'], rows: [['kv']], caption: 'Files' })
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('kv')).toBeInTheDocument()
    expect(screen.getByText('Files')).toBeInTheDocument()
  })

  it('labels an uncaptioned table with its kind tag only', () => {
    // The old fallback caption 'Table' is gone: on B-Blocks the kind tag
    // (B-Blocks:113) is what names a block, and a block without a caption shows no
    // invented one.
    r({ type: 'table', head: ['name'], rows: [['kv']] })
    expect(screen.getByText('table')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('Table')).not.toBeInTheDocument()
  })

  it('counts the table rows in the header', () => {
    r({ type: 'table', head: ['name'], rows: [['a'], ['b'], ['c']] })
    expect(screen.getByText('3 rows')).toBeInTheDocument()
    r({ type: 'table', head: ['name'], rows: [['d']] })
    expect(screen.getByText('1 row')).toBeInTheDocument()
  })

  it('zebra-stripes odd body rows', () => {
    r({ type: 'table', head: ['name'], rows: [['a'], ['b']] })
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[1]?.className).toContain('bg-[var(--c-table-zebra)]')
  })

  it('renders compare sides under the compare kind tag', () => {
    // 'Comparison' was a fallback caption; the kind tag replaces it (B-Blocks:51).
    r({
      type: 'compare',
      left: { title: 'A', items: [{ text: 'fast', ok: true }] },
      right: { title: 'B', items: [{ text: 'slow', ok: false }] },
    })
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('slow')).toBeInTheDocument()
    expect(screen.getByText('compare')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('Comparison')).not.toBeInTheDocument()
  })

  it("shows a compare side's tone in its tag, not in a pane rule or tint", () => {
    // The panes used to carry a 3px top rule in the tone. B-Blocks:52-61 draws one
    // split panel with no rule and no tint: the tone is the tag's fill and text
    // (B-Blocks:54 bad, :58 good). An untoned tag takes the neutral chip.
    r({
      type: 'compare',
      left: { title: 'A', tone: 'good', tag: 'safe', items: [{ text: 'fast', ok: true }] },
      right: { title: 'B', tag: 'plain', items: [{ text: 'slow', ok: false }] },
    })
    expect(screen.getByText('safe').className).toContain('bg-good-soft text-good')
    expect(screen.getByText('plain').className).toContain('bg-chip text-sub')
    const goodPane = screen.getByText('A').parentElement?.parentElement
    expect(goodPane?.className).not.toMatch(/border-t-|bg-good/)
    expect(screen.getByText('✓')).toHaveClass('text-good')
    expect(screen.getByText('✗')).toHaveClass('text-bad')
  })

  it('renders a tag pill on a compare side when tag is present', () => {
    r({
      type: 'compare',
      left: { title: 'A', tone: 'good', tag: 'Recommended', items: [{ text: 'fast', ok: true }] },
      right: { title: 'B', items: [{ text: 'slow', ok: false }] },
    })
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  it('shows the compare caption in the card header when present', () => {
    r({
      type: 'compare',
      caption: 'Before vs after',
      left: { title: 'A', items: [{ text: 'fast', ok: true }] },
      right: { title: 'B', items: [{ text: 'slow', ok: false }] },
    })
    expect(screen.getByText('Before vs after')).toBeInTheDocument()
    expect(screen.queryByText('Comparison')).not.toBeInTheDocument()
  })

  it('renders stat values', () => {
    r({ type: 'stat', items: [{ label: 'files', value: '12' }] })
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('colors a stat value by tone using a static class map', () => {
    r({ type: 'stat', items: [{ label: 'files', value: '12', tone: 'green' }] })
    expect(screen.getByText('12').className).toContain('text-data-green')
  })

  it('shows an untoned stat value in the text color', () => {
    // The default used to be the mauve data hue. B-Blocks:43 draws the untoned
    // value (Peak RPS) in plain text; mauve is now only what tone 'mauve' asks for.
    r({ type: 'stat', items: [{ label: 'files', value: '12' }] })
    expect(screen.getByText('12').className).toContain('text-text')
    expect(screen.getByText('12').className).not.toContain('text-data-mauve')
  })

  it('renders coverage rows under the coverage kind tag, each with its accessible status and its status word', () => {
    // 'Coverage' was a fallback caption; the kind tag replaces it (B-Blocks:65).
    // The full/partial/missing legend is gone: B-Blocks:67-70 writes the status on
    // each row instead, as "full", "part" and "none".
    r({ type: 'coverage', items: [{ label: 'auth', status: 'partial' }] })
    expect(screen.getByText('coverage')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('Coverage')).not.toBeInTheDocument()
    expect(screen.getByLabelText('auth: partial')).toBeInTheDocument()
    expect(screen.getByText('part')).toBeInTheDocument()
    expect(screen.queryByText('partial')).not.toBeInTheDocument()
    expect(screen.queryByText('missing')).not.toBeInTheDocument()
  })

  it('draws a different four-segment bar and word for each coverage status (bug-093, bug-094)', () => {
    r({
      type: 'coverage',
      items: [
        { label: 'a', status: 'full' },
        { label: 'b', status: 'partial' },
        { label: 'c', status: 'missing' },
      ],
    })
    const segments = (label: string) =>
      [...screen.getByLabelText(label).children].map((segment) =>
        segment.className.replace('h-2.5 flex-1 ', ''),
      )
    expect(segments('a: full')).toEqual(['bg-good', 'bg-good', 'bg-good', 'bg-good'])
    expect(segments('b: partial')).toEqual([
      'bg-[var(--c-warn-fill)]',
      'bg-[var(--c-warn-fill)]',
      'bg-line',
      'bg-line',
    ])
    expect(segments('c: missing')).toEqual(
      Array(4).fill('box-border border border-dashed border-bad'),
    )
    expect(screen.getByText('full')).toHaveClass('text-good')
    expect(screen.getByText('part')).toHaveClass('text-warn')
    expect(screen.getByText('none')).toHaveClass('text-bad')
  })

  it('puts the derived coverage percent in the header: full counts 1, part one half', () => {
    // B-Blocks:65 draws the percent in the header; owner decision D3 derives it.
    r({
      type: 'coverage',
      items: [
        { label: 'a', status: 'full' },
        { label: 'b', status: 'partial' },
        { label: 'c', status: 'partial' },
        { label: 'd', status: 'missing' },
      ],
    })
    expect(screen.getByText('50%')).toHaveClass('text-sub')
  })

  it('keeps a coverage note under its label', () => {
    r({ type: 'coverage', items: [{ label: 'auth', status: 'full', note: 'covered by e2e' }] })
    expect(screen.getByText('covered by e2e')).toBeInTheDocument()
  })

  it('shows the coverage caption in the card header when present', () => {
    r({ type: 'coverage', caption: 'Test coverage', items: [{ label: 'auth', status: 'full' }] })
    expect(screen.getByText('Test coverage')).toBeInTheDocument()
    expect(screen.queryByText('Coverage')).not.toBeInTheDocument()
  })

  it('renders details with nested blocks', () => {
    // Details-nested content is NOT annotatable (controller adjudication):
    // nested paragraphs render plain (no HighlightedText, no context needed),
    // so this deliberately renders WITHOUT a ReaderStateProvider.
    r({ type: 'details', summary: 'more', blocks: [{ type: 'p', text: 'inner' }] })
    expect(screen.getByText('more')).toBeInTheDocument()
    expect(screen.getByText('inner')).toBeInTheDocument()
  })

  it('marks a closed details with ▸ in faint and an open one with ▾ in accent (bug-108)', () => {
    r({ type: 'details', summary: 'more', blocks: [{ type: 'p', text: 'inner' }] })
    const details = screen.getByText('more').closest('details')!
    const marker = details.querySelector('[data-details-marker]')!
    expect(details.open).toBe(false)
    expect(marker).toHaveTextContent('▸')
    expect(marker).toHaveClass('text-faint')
    expect(marker).toHaveAttribute('aria-hidden', 'true')

    details.open = true
    fireEvent(details, new Event('toggle'))
    expect(marker).toHaveTextContent('▾')
    expect(marker).toHaveClass('text-accent-text')
    expect(details).toHaveClass('bg-elev')

    details.open = false
    fireEvent(details, new Event('toggle'))
    expect(marker).toHaveTextContent('▸')
    expect(details).not.toHaveClass('bg-elev')
  })

  it('details-nested paragraphs carry no annotation attributes', () => {
    // Regression for the sid=0/bid=0 aliasing defect: a nested p defaulting
    // its indices to 0 would cross-contaminate highlights with section 0's
    // first paragraph. Nested paragraphs must opt out of [data-hl] entirely.
    r({
      type: 'details',
      summary: 'more',
      blocks: [{ type: 'p', text: 'nested paragraph text' }],
    })
    const p = screen.getByText('nested paragraph text')
    expect(p).not.toHaveAttribute('data-hl')
    expect(p).not.toHaveAttribute('data-sid')
    expect(p).not.toHaveAttribute('data-bid')
  })

  it('falls back to JSON for a truly unknown type', () => {
    // Every real block type in the schema — including 'plot3d' (task 8), the
    // last one — now has a real component, so BlockRenderer's default branch
    // is only ever reached by a genuinely unrecognized type (forward compat
    // with a future schema addition, or a legacy payload). `as never` bypasses
    // the discriminated union so this test can still construct one.
    r({ type: 'mystery', marker: 'MYSTERY_MARKER' } as never)
    expect(screen.getByText('mystery')).toBeInTheDocument()
    expect(screen.getByText(/MYSTERY_MARKER/)).toBeInTheDocument()
  })
})
