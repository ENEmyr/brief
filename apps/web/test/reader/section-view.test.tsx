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
  it('renders the section number zero-padded and title without a trailing period', () => {
    renderSection()

    const heading = screen.getByRole('heading', { name: '01 Intro' })
    expect(heading).toBeInTheDocument()
    expect(heading.textContent).toBe('01Intro')
  })

  it('keeps the id and data-section attributes for scroll-sync and anchor links', () => {
    renderSection()

    const el = document.getElementById('s1')
    expect(el).not.toBeNull()
    expect(el).toHaveAttribute('data-section', 's1')
    expect(el?.tagName).toBe('SECTION')
  })

  it('applies the design spacing and scroll-margin classes to the section', () => {
    renderSection()

    const el = document.getElementById('s1')
    expect(el).toHaveClass('mb-11', 'scroll-mt-[76px]')
  })

  it('applies the design chrome classes to the heading and its number span', () => {
    renderSection()

    const heading = screen.getByRole('heading', { name: '01 Intro' })
    expect(heading).toHaveClass('text-[21px]', 'font-bold', 'border-b-2', 'border-mauvesoft')
    const numberSpan = heading.querySelector('span')
    expect(numberSpan).toHaveClass('font-mono', 'text-mauve', 'text-[16px]')
  })

  it('renders the blocks inside the section', () => {
    renderSection()

    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })
})
