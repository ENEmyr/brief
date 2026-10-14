import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetaHeader } from '@/features/reader/components/MetaHeader'
import type { Meta } from '@brief/schema'

const baseMeta: Meta = {
  title: 'Understanding Rate Limiter',
}

describe('MetaHeader', () => {
  it('renders the title without a kicker or subtitle when those fields are absent', () => {
    render(<MetaHeader meta={baseMeta} />)

    expect(screen.getByRole('heading', { name: 'Understanding Rate Limiter' })).toBeInTheDocument()
    expect(screen.queryByText(/DOC-/)).not.toBeInTheDocument()
  })

  // B-Reader's header card has no kicker line; the doc id joins the meta chips.
  it('shows the doc id as the first meta chip only when docId is present', () => {
    render(<MetaHeader meta={{ ...baseMeta, docId: 'DOC-018', author: 'Ada' }} />)

    const chip = screen.getByText('DOC-018')
    expect(chip.parentElement?.firstElementChild).toBe(chip)
  })

  it('renders the subtitle only when present', () => {
    const { rerender } = render(<MetaHeader meta={baseMeta} />)
    expect(screen.queryByText(/Token Bucket/)).not.toBeInTheDocument()

    rerender(
      <MetaHeader
        meta={{ ...baseMeta, subtitle: 'Token Bucket vs Sliding Window' }}
      />,
    )
    expect(screen.getByText('Token Bucket vs Sliding Window')).toBeInTheDocument()
  })

  // B-Reader shows the author as a plain meta chip ("Claude Code"); the avatar circle is gone.
  it('shows the author as a meta chip, with no avatar', () => {
    render(<MetaHeader meta={{ ...baseMeta, author: 'Ada' }} />)

    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.queryByText('A')).not.toBeInTheDocument()
  })

  it('renders role only alongside a present author', () => {
    const { rerender } = render(<MetaHeader meta={{ ...baseMeta, author: 'Ada', role: 'Backend' }} />)
    expect(screen.getByText('Backend')).toBeInTheDocument()

    rerender(<MetaHeader meta={{ ...baseMeta, role: 'Backend' }} />)
    expect(screen.queryByText('Backend')).not.toBeInTheDocument()
  })

  it('orders the chips as B-Reader does: author, role, date, version, repo, read time', () => {
    render(
      <MetaHeader
        meta={{ ...baseMeta, author: 'Claude Code', role: 'backend review', date: '2026-10-14', version: 'v1.3', repo: 'acme/api-gateway', readTime: '8 min' }}
      />,
    )
    const row = screen.getByText('Claude Code').parentElement!
    expect([...row.children].map((c) => c.textContent)).toEqual([
      'Claude Code',
      'backend review',
      '2026-10-14',
      'v1.3',
      'acme/api-gateway',
      '8 min',
    ])
  })

  it('renders date, version, repo, and readTime when present, and links the repo', () => {
    render(
      <MetaHeader
        meta={{
          ...baseMeta,
          date: '2026-07-10',
          version: '1.0',
          repo: 'https://github.com/example/repo',
          readTime: '5 min',
        }}
      />,
    )

    expect(screen.getByText('2026-07-10')).toBeInTheDocument()
    expect(screen.getByText('1.0')).toBeInTheDocument()
    expect(screen.getByText('5 min')).toBeInTheDocument()
    const repoLink = screen.getByRole('link', { name: /github\.com\/example\/repo/ })
    expect(repoLink).toHaveAttribute('href', 'https://github.com/example/repo')
  })

  it('does not render a session id anywhere', () => {
    render(<MetaHeader meta={{ ...baseMeta, author: 'Ada' }} />)

    expect(screen.queryByText(/session/i)).not.toBeInTheDocument()
  })
})
