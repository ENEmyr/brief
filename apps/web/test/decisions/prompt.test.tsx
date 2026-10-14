import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import type { Decision } from '@brief/schema'
import type { ReaderState, ReaderStateStore } from '@/features/reader-state'
import { ReaderStateProvider, useReaderStateStore } from '@/features/reader-state'
import { PromptReviewSheet, SupportTabs, buildReplyPrompt } from '@/features/decisions'

function emptyState(overrides: Partial<ReaderState> = {}): ReaderState {
  return { highlights: [], dsel: {}, dnote: {}, dother: {}, ...overrides }
}

describe('buildReplyPrompt', () => {
  const decisions: Decision[] = [
    {
      id: 'd1',
      q: 'Which cache?',
      multi: false,
      opts: [
        { id: 'kv', label: 'KV' },
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
        { id: 'apac', label: 'APAC' },
      ],
    },
  ]

  it('builds the opening line with docTitle and sessionId, and the closing action line', () => {
    const text = buildReplyPrompt(decisions, emptyState(), 'Rate Limiter', 'abc123')
    const lines = text.split('\n')
    expect(lines[0]).toBe('Reply to the "Rate Limiter" doc (session abc123) - my decisions:')
    expect(lines[lines.length - 1]).toBe(
      'Please act on the answers above; consider the extra context for any item that has a note',
    )
  })

  it('marks an unanswered decision as "(not answered)"', () => {
    const text = buildReplyPrompt(decisions, emptyState(), 'Doc', 's1')
    expect(text).toContain('[d1] Which cache?')
    expect(text).toContain('  - Choice: (not answered)')
  })

  it('resolves a single selected option to its label', () => {
    const state = emptyState({ dsel: { d1: ['kv'] } })
    const text = buildReplyPrompt(decisions, state, 'Doc', 's1')
    expect(text).toContain('  - Choice: KV')
  })

  it('joins multiple selected labels with "; " in opts order, not selection order', () => {
    const state = emptyState({ dsel: { d2: ['apac', 'us'] } })
    const text = buildReplyPrompt(decisions, state, 'Doc', 's1')
    // opts order is us, eu, apac -- selection was [apac, us], so the joined
    // choice must still read "US; APAC", not "APAC; US".
    expect(text).toContain('  - Choice: US; APAC')
  })

  it('prints a single-select Other answer as "Other: <text>"', () => {
    const text = buildReplyPrompt(decisions, emptyState({ dother: { d1: '  Redis  ' } }), 'Doc', 's1')
    expect(text).toContain('[d1] Which cache?\n  - Choice: Other: Redis\n')
  })

  it('joins a multi-select Other answer after the agent options', () => {
    const state = emptyState({ dsel: { d2: ['eu', 'us'] }, dother: { d2: 'LATAM' } })
    const text = buildReplyPrompt(decisions, state, 'Doc', 's1')
    expect(text).toContain('  - Choice: US; EU; Other: LATAM')
  })

  it('prints Other picked with no text yet as "Other:"', () => {
    const text = buildReplyPrompt(decisions, emptyState({ dother: { d1: '' } }), 'Doc', 's1')
    expect(text).toContain('  - Choice: Other:\n')
  })

  it('builds the prompt with open questions: answered ones resolved, open ones "(not answered)"', () => {
    const text = buildReplyPrompt(decisions, emptyState({ dother: { d1: 'Redis' } }), 'Doc', 's1')
    expect(text).toBe(
      [
        'Reply to the "Doc" doc (session s1) - my decisions:',
        '',
        '[d1] Which cache?',
        '  - Choice: Other: Redis',
        '',
        '[d2] Which regions?',
        '  - Choice: (not answered)',
        '',
        'Please act on the answers above; consider the extra context for any item that has a note',
      ].join('\n'),
    )
  })

  it('includes a Note line only when the note is non-empty after trimming', () => {
    const withNote = buildReplyPrompt(decisions, emptyState({ dnote: { d1: '  needs low latency  ' } }), 'Doc', 's1')
    expect(withNote).toContain('  - Note: needs low latency')

    const blankNote = buildReplyPrompt(decisions, emptyState({ dnote: { d1: '   ' } }), 'Doc', 's1')
    expect(blankNote).not.toContain('- Note:')
  })

  it('passes non-Latin (Thai) text through unchanged', () => {
    const thaiDecisions: Decision[] = [
      { id: 'd1', q: 'เลือกอะไรดี', multi: false, opts: [{ id: 'a', label: 'ตัวเลือก ก' }] },
    ]
    const text = buildReplyPrompt(
      thaiDecisions,
      emptyState({ dsel: { d1: ['a'] }, dnote: { d1: 'บันทึกเพิ่มเติม' } }),
      'เอกสารทดสอบ',
      's1',
    )
    expect(text).toContain('Reply to the "เอกสารทดสอบ" doc (session s1) - my decisions:')
    expect(text).toContain('[d1] เลือกอะไรดี')
    expect(text).toContain('  - Choice: ตัวเลือก ก')
    expect(text).toContain('  - Note: บันทึกเพิ่มเติม')
  })
})

describe('SupportTabs', () => {
  const withAll: Decision = {
    id: 'd1',
    q: 'Which cache?',
    multi: false,
    opts: [{ id: 'kv', label: 'KV' }, { id: 'none', label: 'None' }],
    why: 'KV is fast and cheap for this workload.',
    cmp: { head: ['', 'KV', 'None'], rows: [['Latency', 'low', 'n/a']] },
    dia: 'kv-write-path',
  }

  const withNone: Decision = {
    id: 'd2',
    q: 'Which regions?',
    multi: true,
    opts: [{ id: 'us', label: 'US' }],
  }

  it('renders nothing when the decision has no why/cmp/dia', () => {
    const { container } = render(<SupportTabs decision={withNone} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a tab only for each field that is present', () => {
    const onlyWhy: Decision = { ...withNone, why: 'Because reasons.' }
    render(<SupportTabs decision={onlyWhy} />)
    expect(screen.getByRole('tab', { name: 'Explanation' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Compare' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Diagram' })).not.toBeInTheDocument()
  })

  it('renders all three tabs when why/cmp/dia are all present, Explanation active by default', () => {
    render(<SupportTabs decision={withAll} />)
    const explanationTab = screen.getByRole('tab', { name: 'Explanation' })
    expect(explanationTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Compare' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Diagram' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText(withAll.why!)).toBeInTheDocument()
  })

  it('switching to the Compare tab renders the cmp table head and rows', () => {
    render(<SupportTabs decision={withAll} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Compare' }))

    expect(screen.getByRole('tab', { name: 'Compare' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('columnheader', { name: 'KV' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'None' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Latency' })).toBeInTheDocument()
    expect(screen.getByText('low')).toBeInTheDocument()
  })

  it('switching to the Diagram tab renders the string label as a caption note (dia is not a diagram spec)', () => {
    render(<SupportTabs decision={withAll} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Diagram' }))
    expect(screen.getByText('[diagram: kv-write-path]')).toBeInTheDocument()
  })
})

describe('PromptReviewSheet', () => {
  const decisions: Decision[] = [
    { id: 'd1', q: 'Which cache?', multi: false, opts: [{ id: 'kv', label: 'KV' }, { id: 'none', label: 'None' }] },
    { id: 'd2', q: 'Which region?', multi: false, opts: [{ id: 'us', label: 'US' }, { id: 'eu', label: 'EU' }] },
  ]

  let store: ReaderStateStore
  function GrabStore() {
    store = useReaderStateStore()
    return null
  }

  function renderSheet({
    seed = (s: ReaderStateStore) => s.actions.pickOption('d1', 'kv', false),
    copyText = vi.fn(),
    onClose = vi.fn(),
    onGoTo = vi.fn(),
  }: {
    seed?: (s: ReaderStateStore) => void
    copyText?: (text: string) => void
    onClose?: () => void
    onGoTo?: (id: string) => void
  } = {}) {
    function Sheet() {
      return (
        <PromptReviewSheet
          decisions={decisions}
          docTitle="Rate Limiter"
          sessionId="prompt-review-test"
          copyText={copyText}
          onClose={onClose}
          onGoTo={onGoTo}
        />
      )
    }
    const utils = render(
      <ReaderStateProvider sessionId="prompt-review-test" persist={false}>
        <GrabStore />
      </ReaderStateProvider>,
    )
    act(() => seed(store))
    utils.rerender(
      <ReaderStateProvider sessionId="prompt-review-test" persist={false}>
        <GrabStore />
        <Sheet />
      </ReaderStateProvider>,
    )
    return { copyText, onClose, onGoTo, textarea: screen.getByRole('textbox', { name: 'Prompt text' }) as HTMLTextAreaElement }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is a modal dialog titled with the board copy, sub line and close label', () => {
    renderSheet()
    const dialog = screen.getByRole('dialog', { name: 'Review prompt before copying' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Edit freely. This text goes back to the agent.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close prompt review' })).toBeInTheDocument()
  })

  it('opens with open questions: the built prompt prints them as "(not answered)"', () => {
    const { textarea } = renderSheet()
    expect(textarea.value).toBe(buildReplyPrompt(decisions, store.getState(), 'Rate Limiter', 'prompt-review-test'))
    expect(textarea.value).toContain('[d1] Which cache?\n  - Choice: KV')
    expect(textarea.value).toContain('[d2] Which region?\n  - Choice: (not answered)')
  })

  it('counts answered, open and notes, and links to the first open question', () => {
    const { onGoTo } = renderSheet({
      seed: (s) => {
        s.actions.pickOption('d1', 'kv', false)
        s.actions.setDecisionNote('d1', 'low latency')
      },
    })
    expect(screen.getByText('1 answered')).toBeInTheDocument()
    expect(screen.getByText('1 open')).toBeInTheDocument()
    expect(screen.getByText('1 note')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go to d2' }))
    expect(onGoTo).toHaveBeenCalledWith('d2')
  })

  it('shows no open chip and no Go to link once every question is answered', () => {
    renderSheet({
      seed: (s) => {
        s.actions.pickOption('d1', 'kv', false)
        s.actions.pickOther('d2', false)
      },
    })
    expect(screen.getByText('2 answered')).toBeInTheDocument()
    expect(screen.getByText('0 notes')).toBeInTheDocument()
    expect(screen.queryByText(/open$/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Go to/ })).not.toBeInTheDocument()
  })

  it('focuses the prompt text without selecting it, and counts its characters', () => {
    const { textarea } = renderSheet()
    expect(textarea).toHaveFocus()
    expect(textarea.selectionStart).toBe(0)
    expect(textarea.selectionEnd).toBe(0)
    expect(screen.getByText(`${textarea.value.length} chars`)).toBeInTheDocument()
  })

  it('keeps hand edits until Rebuild, even as the answers change', () => {
    const { textarea } = renderSheet()
    fireEvent.change(textarea, { target: { value: 'my hand-edited prompt' } })
    expect(screen.getByText('21 chars')).toBeInTheDocument()

    act(() => store.actions.setDecisionNote('d1', 'a new note'))
    expect(textarea.value).toBe('my hand-edited prompt')

    fireEvent.click(screen.getByRole('button', { name: 'Rebuild from answers' }))
    expect(textarea.value).toContain('  - Choice: KV\n  - Note: a new note')
  })

  it('Copy prompt copies the current text, edits included', () => {
    const { textarea, copyText } = renderSheet()
    fireEvent.change(textarea, { target: { value: 'copy me' } })
    fireEvent.click(screen.getByRole('button', { name: /^Copy prompt/ }))
    expect(copyText).toHaveBeenCalledWith('copy me')
  })

  it('Cmd or Ctrl Enter copies from anywhere in the sheet', () => {
    const { textarea, copyText } = renderSheet()
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Rebuild from answers' }), { key: 'Enter', metaKey: true })
    expect(copyText).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(copyText).toHaveBeenCalledTimes(2)
  })

  it('shows the mod key chip on Copy prompt', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    renderSheet()
    expect(screen.getByRole('button', { name: /^Copy prompt/ })).toHaveTextContent('Copy prompt⌘ Enter')
  })

  it('closes from the close button, Escape and the scrim, never from a click inside, and keeps the answers', () => {
    const { onClose } = renderSheet()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close prompt review' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(store.getState().dsel).toEqual({ d1: ['kv'] })
  })

  it('never prints', () => {
    renderSheet()
    expect(screen.getByRole('dialog').parentElement).toHaveClass('print:hidden')
  })
})
