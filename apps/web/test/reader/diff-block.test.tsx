import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import { parsePatch, patchCounts } from '@/features/reader/components/blocks/diffPatch'
import type { DiffBlock } from '@brief/schema'

const XSS = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'

const BLOCK: DiffBlock = {
  type: 'diff',
  files: [
    {
      path: 'src/limiter.ts',
      status: 'modified',
      patch:
        '@@ -1,4 +1,6 @@\n export async function handle(req, env) {\n   const key = resolveKey(req)\n+  const { success } = await env.LIMITER.limit({ key })\n+  if (!success) return tooMany(30)\n-  return fetch(req.url)\n+  return fetch(origin(req))',
      changes: [
        {
          symbol: 'handle()',
          change: 'modified',
          summary: 'Checks the rate limiter before forwarding.',
        },
        {
          symbol: 'resolveKey()',
          change: 'added',
          summary: 'API key first, client IP only as a fallback.',
          steps: ['read x-api-key', 'fall back to CF-Connecting-IP', 'lowercase and prefix'],
        },
      ],
    },
    {
      path: 'wrangler.toml',
      status: 'modified',
      changes: [{ symbol: '[limits]', change: 'config', summary: 'Adds the LIMITER binding.' }],
    },
    { path: 'bun.lock', status: 'modified', folded: true, patch: '+lock' },
  ],
  map: {
    nodes: [
      { id: 'client', label: 'Client' },
      { id: 'edge', label: 'Edge Worker', status: 'modified' },
      { id: 'limiter', label: 'Limiter', status: 'added' },
    ],
    edges: [
      { from: 'client', to: 'edge' },
      { from: 'edge', to: 'limiter' },
    ],
  },
}

const files = () => within(screen.getByRole('navigation', { name: 'Changed files' }))
const mode = (name: string) =>
  within(screen.getByRole('group', { name: 'Diff mode' })).getByRole('button', { name })

describe('parsePatch', () => {
  it('classifies hunk, added, removed and context lines, file headers as context', () => {
    expect(
      parsePatch('--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n same').map((l) => l.kind),
    ).toEqual(['ctx', 'ctx', 'hunk', 'del', 'add', 'ctx'])
    expect(patchCounts(parsePatch(BLOCK.files[0]!.patch!))).toEqual({ added: 3, removed: 1 })
  })
})

describe('Diff block', () => {
  it('gives every change map node its stable data-diff-node id', () => {
    const { container } = render(<BlockRenderer block={BLOCK} />)
    const ids = [...container.querySelectorAll('[data-diff-node]')].map((n) =>
      n.getAttribute('data-diff-node'),
    )
    expect(ids).toEqual(['client', 'edge', 'limiter'])
    expect(container.querySelector('[data-diff-node="limiter"]')).toHaveClass('pl-4')
    expect(container.querySelector('[data-diff-node="edge"]')).not.toHaveClass('pl-4')
  })

  it('heads the card with the file count and line totals', () => {
    const { container } = render(<BlockRenderer block={BLOCK} />)
    const header = container.querySelector('figure > div')!
    expect(header).toHaveTextContent('diff3 files+4−1')
  })

  it('semantic view lists each change with its kind, note and steps', () => {
    render(<BlockRenderer block={BLOCK} />)
    expect(mode('semantic')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Checks the rate limiter before forwarding.')).toBeInTheDocument()
    expect(screen.getByText('Adds the LIMITER binding.')).toBeInTheDocument()
    expect(screen.getByText('3 steps')).toBeInTheDocument()
    const steps = screen.getByRole('list', { name: '' }) as HTMLElement
    expect(steps.tagName).toBe('OL')
    expect([...steps.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      '1read x-api-key',
      '2fall back to CF-Connecting-IP',
      '3lowercase and prefix',
    ])
  })

  it('the agent note button hides and shows its note', () => {
    render(<BlockRenderer block={BLOCK} />)
    const [first] = screen.getAllByRole('button', { name: '◆ agent: what it does' })
    expect(first).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(first!)
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Checks the rate limiter before forwarding.')).toBeNull()
    fireEvent.click(first!)
    expect(screen.getByText('Checks the rate limiter before forwarding.')).toBeInTheDocument()
  })

  it('raw view prints the patch line by line with add and del tones', () => {
    const { container } = render(<BlockRenderer block={BLOCK} />)
    fireEvent.click(mode('raw'))
    expect(mode('raw')).toHaveAttribute('aria-pressed', 'true')
    const lines = [...container.querySelectorAll('[data-line]')]
    expect(lines.map((l) => l.getAttribute('data-line'))).toEqual([
      'hunk',
      'ctx',
      'ctx',
      'add',
      'add',
      'del',
      'add',
    ])
    expect(lines[5]!.textContent).toBe('-  return fetch(req.url)')
    expect(lines[5]).toHaveClass('bg-bad-soft')
    expect(lines[3]).toHaveClass('bg-good-soft')
    expect(lines[0]).toHaveClass('text-info')
    expect(screen.getByText('No patch for this file.')).toBeInTheDocument()
  })

  it('a folded file starts collapsed and unfolds on demand', () => {
    const { container } = render(<BlockRenderer block={BLOCK} />)
    fireEvent.click(mode('raw'))
    expect(container.querySelectorAll('[data-line]')).toHaveLength(7)
    const unfold = screen.getByRole('button', { name: 'Unfold' })
    expect(unfold).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(unfold)
    expect(container.querySelectorAll('[data-line]')).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Fold' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('the changed-files list scopes the view to one file and back to all', () => {
    render(<BlockRenderer block={BLOCK} />)
    const wrangler = files().getByRole('button', { name: /wrangler\.toml/ })
    expect(wrangler).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(wrangler)
    expect(wrangler).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Adds the LIMITER binding.')).toBeInTheDocument()
    expect(screen.queryByText('Checks the rate limiter before forwarding.')).toBeNull()
    fireEvent.click(wrangler)
    expect(wrangler).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Checks the rate limiter before forwarding.')).toBeInTheDocument()
  })

  it('every control is a native button, so Enter and Space reach it', () => {
    render(<BlockRenderer block={BLOCK} />)
    for (const b of [mode('semantic'), mode('raw'), ...files().getAllByRole('button')]) {
      expect(b.tagName).toBe('BUTTON')
      expect(b).not.toHaveAttribute('tabindex')
    }
  })

  it('renders an XSS string in every payload field as text', () => {
    const evil: DiffBlock = {
      type: 'diff',
      files: [
        {
          path: XSS,
          from: XSS,
          status: 'renamed',
          patch: `@@ ${XSS}\n+${XSS}\n-${XSS}\n ${XSS}`,
          changes: [{ symbol: XSS, change: 'added', summary: XSS, steps: [XSS] }],
        },
      ],
      map: { nodes: [{ id: XSS, label: XSS, status: 'added' }], edges: [{ from: XSS, to: XSS }] },
    }
    const { container } = render(<BlockRenderer block={evil} />)
    const check = () => {
      expect(container.querySelector('script')).toBeNull()
      expect(container.querySelector('img')).toBeNull()
      expect((window as unknown as { __xss?: number }).__xss).toBeUndefined()
    }
    check()
    expect(container.querySelector('[data-diff-node]')).toHaveAttribute('data-diff-node', XSS)
    expect(screen.getAllByText(XSS).length).toBeGreaterThanOrEqual(7)
    fireEvent.click(mode('raw'))
    check()
    expect(container.querySelectorAll('[data-line]')).toHaveLength(4)
    expect(container.querySelector('[data-line="add"]')).toHaveTextContent(`+${XSS}`)
  })
})
