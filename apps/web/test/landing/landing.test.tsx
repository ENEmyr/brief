import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { blockSchema } from '@brief/schema'
import { BLOCK_GROUPS, LandingPage } from '@/features/landing'

/**
 * Every block type the payload schema accepts, read out of the Zod union
 * rather than retyped, so the coverage test below cannot pass by agreeing with
 * a stale copy of the list.
 */
function schemaBlockTypes(): string[] {
  const union = blockSchema as unknown as {
    options: [{ options: { shape: { type: { value: string } } }[] }, { shape: { type: { value: string } } }]
  }
  const [nonRecursive, details] = union.options
  return [...nonRecursive.options.map((option) => option.shape.type.value), details.shape.type.value]
}

describe('landing page', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.setAttribute('data-theme', 'latte')
  })

  it('renders every band', () => {
    render(<LandingPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/decide inside it/i)
    expect(screen.getByRole('heading', { name: /the round trip/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /what it renders/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /wire it up/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /decision card with two options/i })).toBeInTheDocument()
  })

  it('links to the repository', () => {
    render(<LandingPage />)
    const links = screen.getAllByRole('link', { name: /github/i })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('href', expect.stringContaining('github.com/ENEmyr/brief'))
    }
  })

  // The guard the CLAUDE.md schema checklist asks for, one layer out: a new
  // block type that ships without reaching the landing page fails here.
  it('names every block type the schema accepts', () => {
    const listed = new Set(BLOCK_GROUPS.flatMap((group) => group.blocks))
    for (const type of schemaBlockTypes()) {
      expect(listed).toContain(type)
    }
  })

  it('copies the install command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    // The copy chain tries execCommand first; make it fail so the async path runs.
    document.execCommand = vi.fn().mockReturnValue(false)

    render(<LandingPage />)
    fireEvent.click(screen.getByRole('button', { name: /npx skills add ENEmyr\/brief/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('npx skills add ENEmyr/brief'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument(),
    )
    vi.unstubAllGlobals()
  })

  it('swaps the usage example between the skill and raw HTTP', () => {
    render(<LandingPage />)
    const skillTab = screen.getByRole('tab', { name: /with the skill/i })
    const httpTab = screen.getByRole('tab', { name: /straight http/i })

    expect(skillTab).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('tabpanel')).getByText(/npx skills add/i)).toBeInTheDocument()

    fireEvent.click(httpTab)

    expect(httpTab).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('tabpanel')).getByText(/curl -X POST/i)).toBeInTheDocument()
  })
})
