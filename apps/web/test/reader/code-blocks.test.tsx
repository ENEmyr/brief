import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Root, Element } from 'hast'
import { BlockRenderer } from '@/features/reader'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import type { Block } from '@brief/schema'

const { highlightMock } = vi.hoisted(() => ({ highlightMock: vi.fn() }))

vi.mock('@/features/reader/services/shiki', () => ({
  highlightToHast: highlightMock,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** A minimal shiki-shaped hast tree: one uncoloured `<span class="line">`
 * per entry of `lines`, joined by the same literal "\n" text-node separators
 * shiki itself emits between lines. Good enough for tests that don't care
 * about token colors -- see codeLines.test.ts for the color-preservation
 * cases, which build their own line nodes directly. */
function hastFor(lines: string[]): Root {
  const codeChildren: (Element | { type: 'text'; value: string })[] = []
  lines.forEach((line, i) => {
    if (i > 0) codeChildren.push({ type: 'text', value: '\n' })
    codeChildren.push({
      type: 'element',
      tagName: 'span',
      properties: { class: 'line' },
      children: line ? [{ type: 'text', value: line }] : [],
    })
  })
  return {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'pre',
        properties: {
          class: 'shiki console',
          style: 'background-color:var(--shiki-background);color:var(--shiki-foreground)',
        },
        children: [{ type: 'element', tagName: 'code', properties: {}, children: codeChildren }],
      },
    ],
  }
}

const sessionId = 'code-blocks-test'

function r(block: Block, { sid = 0, bid = 0, highlights = [] as Highlight[] } = {}) {
  if (highlights.length) {
    localStorage.setItem(`idocs:${sessionId}`, JSON.stringify({ highlights, dsel: {}, dnote: {} }))
  }
  return render(
    <ReaderStateProvider sessionId={sessionId}>
      <BlockRenderer block={block} sid={sid} bid={bid} />
    </ReaderStateProvider>,
  )
}

const anchorOf = (el: HTMLElement) => el.closest('[data-hl]')

beforeEach(() => {
  highlightMock.mockReset()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('CodeBlock', () => {
  it('renders the plain fallback code text immediately, before highlight resolves', () => {
    const pending = deferred<Root>()
    highlightMock.mockReturnValue(pending.promise)

    r({ type: 'code', language: 'ts', code: 'const a = 1' })

    expect(screen.getByText('const a = 1')).toBeInTheDocument()
  })

  it('shows filename as the header caption when present, else the language', () => {
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({ type: 'code', language: 'ts', code: 'x', filename: 'index.ts' })
    expect(screen.getByText('index.ts')).toBeInTheDocument()

    highlightMock.mockReturnValue(new Promise(() => {}))
    r({ type: 'code', language: 'python', code: 'y' })
    expect(screen.getByText('python')).toBeInTheDocument()
  })

  it('swaps in the highlighted, React-owned tree once shiki resolves', async () => {
    const pending = deferred<Root>()
    highlightMock.mockReturnValue(pending.promise)

    r({ type: 'code', language: 'ts', code: 'const a = 1' })
    pending.resolve(hastFor(['HIGHLIGHTED']))

    await waitFor(() => expect(screen.getByText('HIGHLIGHTED')).toBeInTheDocument())
  })

  it('tints the rows of block.highlight lines from the first paint', () => {
    // block.highlight used to go to shiki, which classed the line span once it
    // resolved. The tint is now the row's (B-Reader:157), drawn from
    // block.highlight directly, so it shows before shiki does and shiki is
    // asked for the code alone.
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({ type: 'code', language: 'ts', code: 'a\nb', highlight: [2] })

    expect(highlightMock).toHaveBeenCalledWith('a\nb', 'ts')
    const rows = document.querySelectorAll('code > span')
    expect(rows[0]?.className).not.toContain('bg-[var(--c-code-line)]')
    expect(rows[1]?.className).toContain('bg-[var(--c-code-line)]')
  })

  it('numbers each line in a gutter outside the line leaf', async () => {
    highlightMock.mockReturnValue(Promise.resolve(hastFor(['first', 'second'])))

    r({ type: 'code', language: 'ts', code: 'first\nsecond' })

    await waitFor(() => expect(screen.getByText('second')).toBeInTheDocument())
    const gutter = screen.getByText('2')
    expect(gutter).toHaveAttribute('aria-hidden', 'true')
    expect(gutter).toHaveClass('select-none', 'w-[26px]', 'text-faint')
    expect(gutter.closest('[data-hl]')).toBeNull()
    expect(anchorOf(screen.getByText('second'))?.textContent).toBe('second')
  })

  it('does not throw when the highlight call rejects (unknown language resilience)', async () => {
    highlightMock.mockReturnValue(Promise.reject(new Error('boom')))

    expect(() => r({ type: 'code', language: 'not-a-real-lang', code: 'still here' })).not.toThrow()
    expect(screen.getByText('still here')).toBeInTheDocument()
  })

  it('anchors each non-empty line at code.<index>, and gives an empty line no anchor at all', async () => {
    highlightMock.mockReturnValue(Promise.resolve(hastFor(['const a = 1', '', 'return a'])))

    r({ type: 'code', language: 'ts', code: 'const a = 1\n\nreturn a' })

    await waitFor(() => expect(screen.getByText('const a = 1')).toBeInTheDocument())
    expect(anchorOf(screen.getByText('const a = 1'))).toHaveAttribute('data-path', 'code.0')
    expect(anchorOf(screen.getByText('return a'))).toHaveAttribute('data-path', 'code.2')

    // The empty line renders as an empty `<span class="line">` with no text
    // to query by, so assert on the DOM directly: it must carry no data-hl.
    // Each line now sits in a row after its gutter, so the line span is the
    // row's last child.
    const lineSpans = document.querySelectorAll('code > span > span:last-child')
    expect(lineSpans).toHaveLength(3)
    expect(lineSpans[1]).toHaveClass('line')
    expect(lineSpans[1]).not.toHaveAttribute('data-hl')
  })

  it('paints a highlight anchored to one code line as a mark', async () => {
    highlightMock.mockReturnValue(Promise.resolve(hastFor(['const a = 1'])))

    r(
      { type: 'code', language: 'ts', code: 'const a = 1' },
      {
        highlights: [
          { id: 'h1', sid: 0, bid: 0, path: 'code.0', start: 6, end: 7, text: 'a', note: null },
        ],
      },
    )

    await waitFor(() => expect(document.querySelector('mark')).not.toBeNull())
    expect(document.querySelector('mark')?.textContent).toBe('a')
  })
})

describe('BeforeAfter', () => {
  // The Before/After segmented toggle showed one side at a time. B-Blocks:141-160
  // draws Split and Unified, with both sides in view and the changed lines tinted.

  it('defaults to Split, showing both sides under their before and after labels', () => {
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({ type: 'ba', language: 'ts', before: 'BEFORE_CODE', after: 'AFTER_CODE' })

    expect(screen.getByText('BEFORE_CODE')).toBeInTheDocument()
    expect(screen.getByText('AFTER_CODE')).toBeInTheDocument()
    expect(screen.getByText('before')).toBeInTheDocument()
    expect(screen.getByText('after')).toBeInTheDocument()
  })

  it('Unified shows one listing in diff order', () => {
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({ type: 'ba', language: 'ts', before: 'keep\nold', after: 'keep\nnew' })

    fireEvent.click(screen.getByRole('button', { name: 'Unified' }))

    const rows = [...document.querySelectorAll('code > span')].map((row) => row.textContent)
    expect(rows).toEqual(['1keep', '2old', '2new'])
    expect(screen.getByText('before / after')).toBeInTheDocument()
  })

  it('uses titleBefore/titleAfter as the side labels when provided', () => {
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({
      type: 'ba',
      language: 'ts',
      before: 'BEFORE_CODE',
      after: 'AFTER_CODE',
      titleBefore: 'Vulnerable',
      titleAfter: 'Rate limited',
    })

    expect(screen.getByText('Vulnerable')).toBeInTheDocument()
    expect(screen.getByText('Rate limited')).toBeInTheDocument()
    expect(screen.queryByText('before')).not.toBeInTheDocument()
  })

  it('marks the active view with aria-pressed', () => {
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({ type: 'ba', language: 'ts', before: 'BEFORE_CODE', after: 'AFTER_CODE' })

    expect(screen.getByRole('button', { name: 'Split' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Unified' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Unified' }))

    expect(screen.getByRole('button', { name: 'Split' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Unified' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('anchors each side at its own field, so before/after lines never collide', async () => {
    highlightMock.mockImplementation((code: string) => Promise.resolve(hastFor(code.split('\n'))))

    r({ type: 'ba', language: 'ts', before: 'BEFORE_CODE', after: 'AFTER_CODE' })

    await waitFor(() => expect(screen.getByText('BEFORE_CODE')).toBeInTheDocument())
    expect(anchorOf(screen.getByText('BEFORE_CODE'))).toHaveAttribute('data-path', 'before.0')
    expect(anchorOf(screen.getByText('AFTER_CODE'))).toHaveAttribute('data-path', 'after.0')

    fireEvent.click(screen.getByRole('button', { name: 'Unified' }))
    expect(anchorOf(screen.getByText('BEFORE_CODE'))).toHaveAttribute('data-path', 'before.0')
    expect(anchorOf(screen.getByText('AFTER_CODE'))).toHaveAttribute('data-path', 'after.0')
  })

  it('tints removed lines bad and added lines good, with the number in the same color', () => {
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({ type: 'ba', language: 'ts', before: 'same\ngone', after: 'same\ncame' })

    const rowOf = (text: string) => screen.getByText(text).closest('code > span')!
    expect(rowOf('gone')).toHaveClass('bg-bad-soft')
    expect(rowOf('came')).toHaveClass('bg-good-soft')
    expect(rowOf('gone').firstElementChild).toHaveClass('text-bad')
    expect(rowOf('came').firstElementChild).toHaveClass('text-good')
    for (const row of screen.getAllByText('same').map((el) => el.closest('code > span')!)) {
      expect(row.className).not.toMatch(/bg-(bad|good)-soft/)
    }
  })
})
