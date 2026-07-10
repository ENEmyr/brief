import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('renders warn callout with title', () => {
    r({ type: 'warn', text: 'careful', title: 'Watch out' })
    expect(screen.getByText('Watch out')).toBeInTheDocument()
    expect(screen.getByText('careful')).toBeInTheDocument()
  })

  it('renders table head and cells with figcaption chrome', () => {
    r({ type: 'table', head: ['name'], rows: [['kv']], caption: 'Files' })
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('kv')).toBeInTheDocument()
    expect(screen.getByText('Files')).toBeInTheDocument()
  })

  it('renders table with a fallback figcaption when no caption is given', () => {
    r({ type: 'table', head: ['name'], rows: [['kv']] })
    expect(screen.getByText('Table')).toBeInTheDocument()
  })

  it('zebra-stripes odd body rows', () => {
    r({ type: 'table', head: ['name'], rows: [['a'], ['b']] })
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[1]?.className).toContain('bg-[var(--row-zebra)]')
  })

  it('renders compare sides with a figcaption', () => {
    r({
      type: 'compare',
      left: { title: 'A', items: [{ text: 'fast', ok: true }] },
      right: { title: 'B', items: [{ text: 'slow', ok: false }] },
    })
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('slow')).toBeInTheDocument()
    expect(screen.getByText('Comparison')).toBeInTheDocument()
  })

  it('applies a toned pane background and border when a compare side has a tone', () => {
    r({
      type: 'compare',
      left: { title: 'A', tone: 'good', items: [{ text: 'fast', ok: true }] },
      right: { title: 'B', tone: 'bad', items: [{ text: 'slow', ok: false }] },
    })
    const goodPane = screen.getByText('A').parentElement?.parentElement
    const badPane = screen.getByText('B').parentElement?.parentElement
    expect(goodPane?.className).toContain('border-t-green')
    expect(goodPane?.className).toContain('--compare-pane-good-bg')
    expect(badPane?.className).toContain('border-t-red')
    expect(badPane?.className).toContain('--compare-pane-bad-bg')
  })

  it('renders a tag pill on a compare side when tag is present', () => {
    r({
      type: 'compare',
      left: { title: 'A', tone: 'good', tag: 'Recommended', items: [{ text: 'fast', ok: true }] },
      right: { title: 'B', items: [{ text: 'slow', ok: false }] },
    })
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  it('shows the compare caption in the figcaption when present', () => {
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
    expect(screen.getByText('12').className).toContain('text-green')
  })

  it('defaults an untoned stat value to mauve', () => {
    r({ type: 'stat', items: [{ label: 'files', value: '12' }] })
    expect(screen.getByText('12').className).toContain('text-mauve')
  })

  it('renders coverage rows with a figcaption, accessible status, and full/partial/missing legend', () => {
    r({ type: 'coverage', items: [{ label: 'auth', status: 'partial' }] })
    expect(screen.getByText('Coverage')).toBeInTheDocument()
    expect(screen.getByLabelText('auth: partial')).toBeInTheDocument()
    expect(screen.getByText('full')).toBeInTheDocument()
    expect(screen.getByText('partial')).toBeInTheDocument()
    expect(screen.getByText('missing')).toBeInTheDocument()
  })

  it('shows the coverage caption in the figcaption when present', () => {
    r({ type: 'coverage', caption: 'Test coverage', items: [{ label: 'auth', status: 'full' }] })
    expect(screen.getByText('Test coverage')).toBeInTheDocument()
    expect(screen.queryByText('Coverage')).not.toBeInTheDocument()
  })

  it('renders details with nested blocks', () => {
    // The nested block is a 'p', so it hits the same HighlightedText/context
    // requirement as the top-level 'p' case above.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    render(
      <ReaderStateProvider sessionId="blocks-test-details">
        <BlockRenderer block={{ type: 'details', summary: 'more', blocks: [{ type: 'p', text: 'inner' }] }} />
      </ReaderStateProvider>,
    )
    expect(screen.getByText('more')).toBeInTheDocument()
    expect(screen.getByText('inner')).toBeInTheDocument()
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
