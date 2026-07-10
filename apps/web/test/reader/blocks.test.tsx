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

  it('renders table head and cells', () => {
    r({ type: 'table', head: ['name'], rows: [['kv']] })
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('kv')).toBeInTheDocument()
  })

  it('renders compare sides', () => {
    r({
      type: 'compare',
      left: { title: 'A', items: [{ text: 'fast', ok: true }] },
      right: { title: 'B', items: [{ text: 'slow', ok: false }] },
    })
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('slow')).toBeInTheDocument()
  })

  it('renders stat values', () => {
    r({ type: 'stat', items: [{ label: 'files', value: '12' }] })
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders coverage statuses', () => {
    r({ type: 'coverage', items: [{ label: 'auth', status: 'partial' }] })
    expect(screen.getByText('partial')).toBeInTheDocument()
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
