import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DecisionSection } from '@/features/decisions'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Decision } from '@brief/schema'

const decisions: Decision[] = [
  {
    id: 'd1',
    q: 'Which cache?',
    multi: false,
    opts: [
      { id: 'kv', label: 'KV', detail: 'Fast, eventually consistent' },
      { id: 'none', label: 'None' },
    ],
  },
  {
    id: 'd2',
    q: 'Which regions?',
    multi: true,
    opts: [
      { id: 'us', label: 'US' },
      { id: 'eu', label: 'EU' },
    ],
  },
]

function renderSection(list: Decision[] = decisions, sessionId = 'decisions-test') {
  return render(
    <ReaderStateProvider sessionId={sessionId}>
      <DecisionSection decisions={list} no={2} docTitle="Rate Limiter" sessionId={sessionId} />
    </ReaderStateProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('DecisionSection', () => {
  it('renders nothing when there are no decisions', () => {
    const { container } = renderSection([])
    expect(container.firstChild).toBeNull()
  })

  it('renders the zero-padded section number, id, and data-section for TOC scroll-sync', () => {
    renderSection()
    const heading = screen.getByRole('heading', { name: '02 Decisions' })
    expect(heading).toBeInTheDocument()
    const el = document.getElementById('decide')
    expect(el).not.toBeNull()
    expect(el).toHaveAttribute('data-section', 'decide')
  })

  it('shows the initial answered count and a jump button per question', () => {
    renderSection()
    expect(screen.getByText('Answered 0/2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Question d1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Question d2' })).toBeInTheDocument()

    const progress = screen.getByRole('progressbar', { name: /decisions answered/i })
    expect(progress).toHaveAttribute('aria-valuenow', '0')
    expect(progress).toHaveAttribute('aria-valuemax', '2')
  })

  it('renders the detail sub-line only for options that have one', () => {
    renderSection()
    expect(screen.getByText('Fast, eventually consistent')).toBeInTheDocument()
  })

  it('shows the multi-select pill only for multi questions', () => {
    renderSection()
    expect(screen.queryByText('select all that apply')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Question d2' }))
    expect(screen.getByText('select all that apply')).toBeInTheDocument()
  })

  it('single-select: picking an option marks it pressed and bumps the answered count', () => {
    renderSection()
    const kv = screen.getByRole('button', { name: /KV/ })
    expect(kv).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(kv)

    expect(kv).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Answered 1/2')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /decisions answered/i })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
  })

  it('single-select: picking a second option replaces the first', () => {
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: /KV/ }))
    fireEvent.click(screen.getByRole('button', { name: /None/ }))

    expect(screen.getByRole('button', { name: /KV/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /None/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Answered 1/2')).toBeInTheDocument()
  })

  it('multi-select: toggles options independently without clearing sibling picks', () => {
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Question d2' }))

    const us = screen.getByRole('button', { name: /^US$/ })
    const eu = screen.getByRole('button', { name: /^EU$/ })

    fireEvent.click(us)
    fireEvent.click(eu)
    expect(us).toHaveAttribute('aria-pressed', 'true')
    expect(eu).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(us)
    expect(us).toHaveAttribute('aria-pressed', 'false')
    expect(eu).toHaveAttribute('aria-pressed', 'true')
  })

  it('prev/next clamp at the first and last question', () => {
    renderSection()
    const prev = screen.getByRole('button', { name: '‹ Previous' })
    const next = screen.getByRole('button', { name: 'Next ›' })

    expect(prev).toBeDisabled()
    expect(next).not.toBeDisabled()
    expect(screen.getByText('Which cache?')).toBeInTheDocument()

    fireEvent.click(next)
    expect(screen.getByText('Which regions?')).toBeInTheDocument()
    expect(next).toBeDisabled()
    expect(prev).not.toBeDisabled()

    fireEvent.click(prev)
    expect(screen.getByText('Which cache?')).toBeInTheDocument()
  })

  it('a jump button navigates directly to that question', () => {
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Question d2' }))
    expect(screen.getByText('Which regions?')).toBeInTheDocument()
  })

  it('shows the "answer N more" gate text until every question is answered, then a generate button', () => {
    const onGeneratePrompt = vi.fn()
    render(
      <ReaderStateProvider sessionId="decisions-gate-test">
        <DecisionSection
          decisions={decisions}
          no={2}
          docTitle="Rate Limiter"
          sessionId="decisions-gate-test"
          onGeneratePrompt={onGeneratePrompt}
        />
      </ReaderStateProvider>,
    )

    expect(screen.getByText('Answer 2 more to generate a prompt')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generate prompt/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /KV/ }))
    expect(screen.getByText('Answer 1 more to generate a prompt')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Question d2' }))
    fireEvent.click(screen.getByRole('button', { name: /^US$/ }))

    expect(screen.queryByText(/more to generate a prompt/)).not.toBeInTheDocument()
    const generateButton = screen.getByRole('button', { name: /Generate prompt/ })
    expect(generateButton).toBeInTheDocument()

    fireEvent.click(generateButton)
    expect(onGeneratePrompt).toHaveBeenCalledTimes(1)
  })

  it('notes textarea writes to the store for the current question and is scoped per-question', () => {
    renderSection()
    const textarea = screen.getByPlaceholderText(/business reason/)
    fireEvent.change(textarea, { target: { value: 'needs low latency' } })
    expect(textarea).toHaveValue('needs low latency')

    fireEvent.click(screen.getByRole('button', { name: 'Question d2' }))
    expect(screen.getByPlaceholderText(/business reason/)).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Question d1' }))
    expect(screen.getByPlaceholderText(/business reason/)).toHaveValue('needs low latency')
  })

  it('reset clears every answer and note, and only shows once something is answered', () => {
    renderSection()
    expect(screen.queryByRole('button', { name: '↺ Reset' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /KV/ }))
    fireEvent.change(screen.getByPlaceholderText(/business reason/), {
      target: { value: 'some note' },
    })

    const resetButton = screen.getByRole('button', { name: '↺ Reset' })
    fireEvent.click(resetButton)

    expect(screen.getByText('Answered 0/2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /KV/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByPlaceholderText(/business reason/)).toHaveValue('')
    expect(screen.queryByRole('button', { name: '↺ Reset' })).not.toBeInTheDocument()
  })

  it('calls the onReset callback after clearing (toast hook, no-op by default)', () => {
    const onReset = vi.fn()
    render(
      <ReaderStateProvider sessionId="decisions-reset-test">
        <DecisionSection
          decisions={decisions}
          no={2}
          docTitle="Rate Limiter"
          sessionId="decisions-reset-test"
          onReset={onReset}
        />
      </ReaderStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /KV/ }))
    fireEvent.click(screen.getByRole('button', { name: '↺ Reset' }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('renders no support tab strip when the current question has no why/cmp/dia', () => {
    renderSection()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})
