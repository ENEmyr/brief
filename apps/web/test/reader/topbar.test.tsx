import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Topbar } from '@/features/reader/components/Topbar'

describe('Topbar', () => {
  it('renders brand, session chip, theme toggle, and print button', () => {
    render(<Topbar sessionId="abc12345678901" repo="https://github.com/example/repo" />)

    expect(screen.getByText('Brief')).toBeInTheDocument()
    expect(screen.getByText('abc12345678901')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
  })

  it('omits the session chip when no sessionId is provided', () => {
    render(<Topbar />)

    expect(screen.getByText('Brief')).toBeInTheDocument()
    expect(screen.queryByText(/session/i)).not.toBeInTheDocument()
  })
})
