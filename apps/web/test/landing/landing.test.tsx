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
    document.documentElement.setAttribute('data-theme', 'light')
  })

  it('renders every band', () => {
    render(<LandingPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Your agent writes the document. You decide inside it.',
    )
    for (const name of [
      'How it works',
      'Wire it up',
      'What you get back',
      'Blocks',
      'Small things that add up',
      'Give your agent a better way to ask.',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(screen.getByRole('img', { name: 'Preview of a brief' })).toBeInTheDocument()
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

  it('names no block type the schema does not accept', () => {
    const accepted = new Set([...schemaBlockTypes(), 'decision'])
    for (const type of BLOCK_GROUPS.flatMap((group) => group.blocks)) {
      expect(accepted).toContain(type)
    }
  })

  it('copies the install command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    // The copy chain tries execCommand first; make it fail so the async path runs.
    document.execCommand = vi.fn().mockReturnValue(false)

    render(<LandingPage />)
    const [hero] = screen.getAllByRole('button', { name: 'Copy install command' })
    fireEvent.click(hero!)

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('npx skills add ENEmyr/brief'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toHaveTextContent('copied'))
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

  it('uses 14-character session ids in every example link', () => {
    render(<LandingPage />)
    const ids = () => {
      const found: string[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const m of node.textContent!.matchAll(/\/s\/([0-9A-Za-z]+)/g)) found.push(m[1]!)
      }
      return found
    }
    const skillIds = ids()
    fireEvent.click(screen.getByRole('tab', { name: /straight http/i }))
    const all = [...skillIds, ...ids()]
    expect(all.length).toBeGreaterThanOrEqual(6)
    for (const id of all) expect(id).toBe('k2p9x4Qm7Zr1Ta')
    expect(document.body.textContent).toContain('/api/session/k2p9x4Qm7Zr1Ta/raw')
  })

  it('previews the three view tabs the reader has', () => {
    render(<LandingPage />)
    const preview = screen.getByRole('img', { name: 'Preview of a brief' })
    const tabs = ['Document', 'Diagrams', 'Decisions', 'Raw'].filter((tab) => within(preview).queryByText(tab))
    expect(tabs).toEqual(['Document', 'Diagrams', 'Raw'])
  })
})
