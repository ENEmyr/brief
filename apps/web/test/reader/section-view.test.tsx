import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionView } from '@/features/reader/components/SectionView'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Section } from '@brief/schema'

const section: Section = {
  id: 's1',
  no: 1,
  title: 'Intro',
  blocks: [{ type: 'p', text: 'Hello world' }],
}

// The fixture's block is type 'p', so SectionView's Paragraph now renders
// through HighlightedText, which reads reader state via context -- every
// test in this file needs the provider (and its KV-sync fetch stubbed).
function renderSection(s: Section = section) {
  return render(
    <ReaderStateProvider sessionId="section-view-test">
      <SectionView section={s} sid={0} />
    </ReaderStateProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
})

afterEach(() => vi.unstubAllGlobals())

describe('SectionView', () => {
  // B-Reader's card header puts the number beside the h2, not inside it.
  it('renders the zero-padded number beside the title in the card header row', () => {
    renderSection()

    const heading = screen.getByRole('heading', { name: 'Intro' })
    expect(heading.textContent).toBe('Intro')
    expect(heading.parentElement?.textContent).toBe('01Intro')
  })

  it('keeps the id and data-section attributes for scroll-sync and anchor links', () => {
    renderSection()

    const el = document.getElementById('s1')
    expect(el).not.toBeNull()
    expect(el).toHaveAttribute('data-section', 's1')
    expect(el?.tagName).toBe('SECTION')
  })

  // The section is now a B-Reader card: card fill, line border, radius 6, scroll margin 72.
  it('is a card with the board scroll margin', () => {
    renderSection()

    const el = document.getElementById('s1')
    expect(el).toHaveClass('scroll-mt-[72px]', 'rounded-[6px]', 'border', 'border-line', 'bg-card')
  })

  it('styles the header row as B-Reader: 12px accent number, 18/26 600 title, line under it', () => {
    renderSection()

    const heading = screen.getByRole('heading', { name: 'Intro' })
    expect(heading).toHaveClass('text-[18px]', 'font-semibold', 'leading-[26px]')
    const row = heading.parentElement!
    expect(row).toHaveClass('border-b', 'border-line', 'px-4', 'py-3')
    expect(row.querySelector('span')).toHaveClass('font-mono', 'text-accent-text', 'text-[12px]')
  })

  it('flashes after a jump, alternating the animation so a repeat jump restarts it', () => {
    const { rerender } = renderSection()
    const el = document.getElementById('s1')!
    expect(el).not.toHaveAttribute('data-flash')

    rerender(
      <ReaderStateProvider sessionId="section-view-test">
        <SectionView section={section} sid={0} flash={1} />
      </ReaderStateProvider>,
    )
    expect(el).toHaveAttribute('data-flash', 'b')
    rerender(
      <ReaderStateProvider sessionId="section-view-test">
        <SectionView section={section} sid={0} flash={2} />
      </ReaderStateProvider>,
    )
    expect(el).toHaveAttribute('data-flash', 'a')
  })

  it('keeps only the given block types, at their payload index', () => {
    render(
      <ReaderStateProvider sessionId="section-view-test">
        <SectionView
          section={{ ...section, blocks: [{ type: 'p', text: 'Hello world' }, { type: 'warn', text: 'Careful' }] }}
          sid={0}
          only={new Set(['warn'])}
        />
      </ReaderStateProvider>,
    )
    expect(screen.queryByText('Hello world')).not.toBeInTheDocument()
    expect(screen.getByText('Careful').closest('[data-bid]')).toHaveAttribute('data-bid', '1')
  })

  it('renders the blocks inside the section', () => {
    renderSection()

    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })
})
