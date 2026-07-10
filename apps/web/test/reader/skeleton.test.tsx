import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from '@/features/reader/components/Skeleton'

describe('Skeleton', () => {
  it('renders the shimmer layout with multiple .sk bars', () => {
    const { container } = render(<Skeleton />)

    expect(container.querySelectorAll('.sk').length).toBeGreaterThanOrEqual(13)
  })
})
