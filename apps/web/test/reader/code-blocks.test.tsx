import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import type { Block } from '@brief/schema'

const { highlightMock } = vi.hoisted(() => ({ highlightMock: vi.fn() }))

vi.mock('@/features/reader/services/shiki', () => ({
  highlight: highlightMock,
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

const r = (block: Block) => render(<BlockRenderer block={block} />)

beforeEach(() => {
  highlightMock.mockReset()
})

describe('CodeBlock', () => {
  it('renders the plain fallback code text immediately, before highlight resolves', () => {
    const pending = deferred<string>()
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

  it('swaps in the highlighted HTML once shiki resolves', async () => {
    const pending = deferred<string>()
    highlightMock.mockReturnValue(pending.promise)

    r({ type: 'code', language: 'ts', code: 'const a = 1' })
    pending.resolve('<pre class="shiki"><code><span class="line">HIGHLIGHTED</span></code></pre>')

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
})
