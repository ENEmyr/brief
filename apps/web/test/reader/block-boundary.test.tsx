import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'

vi.mock('@/features/reader/components/blocks/Callout', () => ({
  Callout: () => {
    throw new Error(
      'boom at Callout (/home/dev/brief/apps/web/src/features/reader/components/blocks/Callout.tsx:42:7)',
    )
  },
}))

afterEach(() => vi.restoreAllMocks())

describe('a block that throws (B-States: one broken block never takes the page down)', () => {
  it('renders its card in the error state with fixed copy, and no message, stack or path', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<BlockRenderer block={{ type: 'warn', text: 'careful' }} />)

    expect(screen.getByText('warn')).toHaveAttribute('data-kind-tag')
    expect(screen.getByRole('alert')).toHaveTextContent('This block could not be drawn.')
    const text = container.textContent ?? ''
    expect(text).not.toContain('boom')
    expect(text).not.toContain('/home/')
    expect(text).not.toContain('Callout.tsx')
    expect(text).not.toMatch(/\bat \w+ \(/)
  })

  it('keeps the block data reachable under "Show raw block"', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<BlockRenderer block={{ type: 'warn', text: 'careful' }} />)
    expect(screen.getByText('Show raw block').closest('details')?.textContent).toContain(
      '"careful"',
    )
  })

  it('leaves its siblings rendering', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <>
        <BlockRenderer block={{ type: 'warn', text: 'careful' }} />
        <BlockRenderer block={{ type: 'table', head: ['name'], rows: [['kv']] }} />
      </>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
