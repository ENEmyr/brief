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

  it('renders the kicker only when docId is present', () => {
    render(<MetaHeader meta={{ ...baseMeta, docId: 'DOC-018' }} />)

    expect(screen.getByText('DOC-018')).toBeInTheDocument()
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

  it('shows an avatar with the first character of the author when author is present', () => {
    render(<MetaHeader meta={{ ...baseMeta, author: 'Ada' }} />)

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('Ada')).toBeInTheDocument()
  })

  it('omits the avatar and author block entirely when author is absent', () => {
    render(<MetaHeader meta={baseMeta} />)

    expect(screen.queryByText('A')).not.toBeInTheDocument()
  })

  it('renders role only alongside a present author', () => {
    render(<MetaHeader meta={{ ...baseMeta, author: 'Ada', role: 'Backend' }} />)

    expect(screen.getByText(/Backend/)).toBeInTheDocument()
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
