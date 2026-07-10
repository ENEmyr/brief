import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionView } from '@/features/reader/components/SectionView'
import type { Section } from '@brief/schema'

const section: Section = {
  id: 's1',
  no: 1,
  title: 'Intro',
  blocks: [{ type: 'p', text: 'Hello world' }],
}

describe('SectionView', () => {
  it('renders the section number zero-padded and title without a trailing period', () => {
    render(<SectionView section={section} />)

    const heading = screen.getByRole('heading', { name: '01 Intro' })
    expect(heading).toBeInTheDocument()
    expect(heading.textContent).toBe('01Intro')
  })

  it('keeps the id and data-section attributes for scroll-sync and anchor links', () => {
    render(<SectionView section={section} />)

    const el = document.getElementById('s1')
    expect(el).not.toBeNull()
    expect(el).toHaveAttribute('data-section', 's1')
    expect(el?.tagName).toBe('SECTION')
  })

  it('applies the design spacing and scroll-margin classes to the section', () => {
    render(<SectionView section={section} />)

    const el = document.getElementById('s1')
    expect(el).toHaveClass('mb-11', 'scroll-mt-[76px]')
  })

  it('applies the design chrome classes to the heading and its number span', () => {
    render(<SectionView section={section} />)

    const heading = screen.getByRole('heading', { name: '01 Intro' })
    expect(heading).toHaveClass('text-[21px]', 'font-bold', 'border-b-2', 'border-mauvesoft')
    const numberSpan = heading.querySelector('span')
    expect(numberSpan).toHaveClass('font-mono', 'text-mauve', 'text-[16px]')
  })

  it('renders the blocks inside the section', () => {
    render(<SectionView section={section} />)

    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })
})
