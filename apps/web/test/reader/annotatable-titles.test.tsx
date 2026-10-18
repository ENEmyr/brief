import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import { BlockCard } from '@/features/reader/components/BlockCard'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Block } from '@brief/schema'

// CodeBlock's body goes through shiki; only the header bar matters here, so the
// highlight call is stubbed out with a promise that never settles.
const { highlightMock } = vi.hoisted(() => ({ highlightMock: vi.fn() }))
vi.mock('@/features/reader/services/shiki', () => ({ highlightToHast: highlightMock }))

beforeEach(() => {
  highlightMock.mockReset()
  highlightMock.mockReturnValue(new Promise(() => {}))
  // ReaderStateProvider syncs with KV on mount.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
})

/** A block rendered where it really lives: section 2, block 3, inside a
 *  reader-state provider (HighlightedText reads highlights from context). */
function renderBlock(block: Block, { sid = 2, bid = 3 } = {}) {
  return render(
    <ReaderStateProvider sessionId="annotatable-titles">
      <BlockRenderer block={block} sid={sid} bid={bid} />
    </ReaderStateProvider>,
  )
}

const seqWithTitle: Extract<Block, { type: 'seq' }> = {
  type: 'seq',
  title: 'Rate limit flow',
  actors: ['Client', 'API'],
  steps: [{ from: 'Client', to: 'API', label: 'request' }],
}

/** The title of every hand-drawn diagram block is the same leaf: `title`. */
const titledDiagrams: { block: Block; title: string }[] = [
  {
    title: 'Schema',
    block: {
      type: 'erd',
      title: 'Schema',
      tables: [{ name: 'users', columns: [{ name: 'id', type: 'uuid' }] }],
    },
  },
  {
    title: 'Session states',
    block: {
      type: 'state',
      title: 'Session states',
      initial: 'open',
      states: [{ id: 'open', label: 'Open' }],
      transitions: [],
    },
  },
  {
    title: 'Stack',
    block: {
      type: 'layers',
      title: 'Stack',
      layers: [{ id: 'l1', label: 'Edge', nodes: [{ id: 'n', label: 'Worker' }], edges: [] }],
    },
  },
]

describe('annotatable diagram titles', () => {
  it('anchors a diagram card caption to the block title leaf', () => {
    renderBlock(seqWithTitle)

    const caption = screen.getByText('Rate limit flow')
    expect(caption).toHaveAttribute('data-hl')
    expect(caption).toHaveAttribute('data-sid', '2')
    expect(caption).toHaveAttribute('data-bid', '3')
    expect(caption).toHaveAttribute('data-path', 'title')
  })

  it.each(titledDiagrams)('anchors the $block.type title too', ({ block, title }) => {
    renderBlock(block)

    expect(screen.getByText(title)).toHaveAttribute('data-path', 'title')
  })

  it('leaves the kind tag of an untitled diagram as plain chrome', () => {
    // The fallback caption 'Sequence' gave way to the kind tag (B-Blocks:75). The tag
    // is not in the payload either, so there is no leaf to anchor to:
    // annotating it would name a leaf that does not exist.
    renderBlock({ ...seqWithTitle, title: undefined })

    expect(screen.getByText('seq')).not.toHaveAttribute('data-hl')
    expect(screen.queryByText('Sequence')).not.toBeInTheDocument()
  })

  it('addresses a nested diagram title under its blocks.<i>. prefix', () => {
    renderBlock({ type: 'details', summary: 'More', blocks: [seqWithTitle] })

    expect(screen.getByText('Rate limit flow')).toHaveAttribute('data-path', 'blocks.0.title')
  })
})

describe('annotatable code headers', () => {
  it('anchors the filename header to the filename leaf', () => {
    renderBlock({ type: 'code', language: 'ts', filename: 'src/index.ts', code: 'const a = 1' })

    const header = screen.getByText('src/index.ts')
    expect(header).toHaveAttribute('data-hl')
    expect(header).toHaveAttribute('data-sid', '2')
    expect(header).toHaveAttribute('data-bid', '3')
    expect(header).toHaveAttribute('data-path', 'filename')
  })

  it('anchors the language header when the block has no filename', () => {
    renderBlock({ type: 'code', language: 'ts', code: 'const a = 1' })

    expect(screen.getByText('ts')).toHaveAttribute('data-path', 'language')
  })

  it('anchors each side of a before/after header to its own leaf', () => {
    renderBlock({
      type: 'ba',
      language: 'ts',
      before: 'a',
      after: 'b',
      titleBefore: 'Nested loop',
      titleAfter: 'Single pass',
    })

    // Split view (B-Blocks:141-160) shows both sides at once, so both titles are
    // on screen together; there is no After button to press any more.
    expect(screen.getByText('Nested loop')).toHaveAttribute('data-path', 'titleBefore')
    expect(screen.getByText('Single pass')).toHaveAttribute('data-path', 'titleAfter')
  })

  it('leaves an untitled before/after header as plain chrome', () => {
    renderBlock({ type: 'ba', language: 'ts', before: 'a', after: 'b' })

    // An untitled side is labelled with the board's lowercase 'before' (B-Blocks:145).
    expect(screen.getByText('before')).not.toHaveAttribute('data-hl')
    expect(screen.getByText('before').querySelector('[data-hl]')).toBeNull()
  })
})

describe('BlockCard without an anchor', () => {
  it('renders the caption as plain text, exactly as before', () => {
    // DiagramCard is gone; BlockCard is the one header every block uses now,
    // and an anchorless caption must stay plain text there too.
    render(
      <BlockCard kind="seq" caption={{ text: 'Login flow', path: 'title' }}>
        <svg data-testid="diagram" />
      </BlockCard>,
    )

    const caption = screen.getByText('Login flow')
    expect(caption).not.toHaveAttribute('data-hl')
    expect(caption).not.toHaveAttribute('data-sid')
    expect(caption).not.toHaveAttribute('data-path')
  })
})
