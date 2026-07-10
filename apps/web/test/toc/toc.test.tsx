import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toc } from '@/features/toc'

const sections = [
  { id: 's1', no: 1, title: 'Introduction' },
  { id: 's2', no: 2, title: 'Getting Started' },
]

function mountSectionElements() {
  document.body.innerHTML = `
    <section data-section="s1" id="s1"></section>
    <section data-section="s2" id="s2"></section>
  `
}

describe('toc', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders a list item for each section', () => {
    render(<Toc sections={sections} />)

    expect(screen.getByText(/1\. Introduction/)).toBeInTheDocument()
    expect(screen.getByText(/2\. Getting Started/)).toBeInTheDocument()
  })

  it('scrolls the matching section into view on click', () => {
    mountSectionElements()
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(<Toc sections={sections} />)
    fireEvent.click(screen.getByText(/2\. Getting Started/))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('toggles and persists the collapsed state', () => {
    render(<Toc sections={sections} />)

    expect(localStorage.getItem('idocs:toc')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /collapse table of contents/i }))
    expect(localStorage.getItem('idocs:toc')).toBe('closed')

    fireEvent.click(screen.getByRole('button', { name: /expand table of contents/i }))
    expect(localStorage.getItem('idocs:toc')).toBe('open')
  })

  it('renders the toc nav landmark', () => {
    render(<Toc sections={sections} />)
    expect(screen.getByRole('navigation', { name: /table of contents/i })).toBeInTheDocument()
  })
})
