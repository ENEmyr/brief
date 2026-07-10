import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import type { Block } from '@brief/schema'

const r = (block: Block) => render(<BlockRenderer block={block} />)

describe('BlockRenderer text family', () => {
  it('renders p', () => {
    r({ type: 'p', text: 'hello world' })
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
    r({ type: 'details', summary: 'more', blocks: [{ type: 'p', text: 'inner' }] })
    expect(screen.getByText('more')).toBeInTheDocument()
    expect(screen.getByText('inner')).toBeInTheDocument()
  })

  it('falls back to JSON for not-yet-implemented types', () => {
    r({ type: 'mermaid', code: 'graph TD; a-->b' } as Block)
    expect(screen.getByText(/graph TD/)).toBeInTheDocument()
  })
})
