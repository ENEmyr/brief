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
        properties: { class: 'shiki catppuccin-mocha', style: 'background-color:#1e1e2e;color:#cdd6f4' },
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

  it('passes block.highlight line numbers through to the highlight call', () => {
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({ type: 'code', language: 'ts', code: 'a\nb', highlight: [2] })

    expect(highlightMock).toHaveBeenCalledWith('a\nb', 'ts', { highlightLines: [2] })
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
    const lineSpans = document.querySelectorAll('code > span')
    expect(lineSpans).toHaveLength(3)
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
  it('defaults to showing Before code and caption', () => {
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({ type: 'ba', language: 'ts', before: 'BEFORE_CODE', after: 'AFTER_CODE' })

    expect(screen.getByText('BEFORE_CODE')).toBeInTheDocument()
    // "Before" appears both as the header caption and the segment button.
    expect(screen.getAllByText('Before').length).toBe(2)
    expect(screen.queryByText('AFTER_CODE')).not.toBeInTheDocument()
  })

  it('the segmented toggle switches which code is shown', () => {
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({ type: 'ba', language: 'ts', before: 'BEFORE_CODE', after: 'AFTER_CODE' })

    fireEvent.click(screen.getByRole('button', { name: 'After' }))

    expect(screen.getByText('AFTER_CODE')).toBeInTheDocument()
    expect(screen.queryByText('BEFORE_CODE')).not.toBeInTheDocument()
  })

  it('uses titleBefore/titleAfter as the caption when provided', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'After' }))
    expect(screen.getByText('Rate limited')).toBeInTheDocument()
  })

  it('marks the active segment with aria-pressed, matching the Layers chip convention', () => {
    highlightMock.mockReturnValue(new Promise(() => {}))

    r({ type: 'ba', language: 'ts', before: 'BEFORE_CODE', after: 'AFTER_CODE' })

    expect(screen.getByRole('button', { name: 'Before' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'After' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'After' }))

    expect(screen.getByRole('button', { name: 'Before' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'After' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('anchors each side at its own field, so before/after lines never collide', async () => {
    highlightMock.mockImplementation((code: string) => Promise.resolve(hastFor(code.split('\n'))))

    r({ type: 'ba', language: 'ts', before: 'BEFORE_CODE', after: 'AFTER_CODE' })

    await waitFor(() => expect(screen.getByText('BEFORE_CODE')).toBeInTheDocument())
    expect(anchorOf(screen.getByText('BEFORE_CODE'))).toHaveAttribute('data-path', 'before.0')

    fireEvent.click(screen.getByRole('button', { name: 'After' }))
    await waitFor(() => expect(screen.getByText('AFTER_CODE')).toBeInTheDocument())
    expect(anchorOf(screen.getByText('AFTER_CODE'))).toHaveAttribute('data-path', 'after.0')
  })
})
