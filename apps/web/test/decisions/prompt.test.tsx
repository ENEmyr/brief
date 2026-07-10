import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Decision } from '@brief/schema'
import type { ReaderState } from '@/features/reader-state'
import { ReaderStateProvider } from '@/features/reader-state'
import { DecisionSection, SupportTabs, PromptReview, buildReplyPrompt } from '@/features/decisions'

function emptyState(overrides: Partial<ReaderState> = {}): ReaderState {
  return { highlights: [], dsel: {}, dnote: {}, ...overrides }
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

describe('PromptReview', () => {
  it('renders the hint line, current text, and close aria-label', () => {
    render(
      <PromptReview text="hello world" onChange={() => {}} onRebuild={() => {}} onClose={() => {}} />,
    )
    expect(screen.getByText(/Edit the text below as you like/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Prompt text' })).toHaveValue('hello world')
    expect(screen.getByRole('button', { name: 'Close prompt review' })).toBeInTheDocument()
  })

  it('calls onChange as the textarea is edited', () => {
    const onChange = vi.fn()
    render(
      <PromptReview text="original" onChange={onChange} onRebuild={() => {}} onClose={() => {}} />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt text' }), {
      target: { value: 'edited' },
    })
    expect(onChange).toHaveBeenCalledWith('edited')
  })

  it('calls onRebuild when "Rebuild from answers" is clicked', () => {
    const onRebuild = vi.fn()
    render(<PromptReview text="x" onChange={() => {}} onRebuild={onRebuild} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '↻ Rebuild from answers' }))
    expect(onRebuild).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<PromptReview text="x" onChange={() => {}} onRebuild={() => {}} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close prompt review' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('copy invokes copyText with the current textarea content, then onCopied', () => {
    const copyText = vi.fn()
    const onCopied = vi.fn()
    render(
      <PromptReview
        text="copy me"
        onChange={() => {}}
        onRebuild={() => {}}
        onClose={() => {}}
        onCopied={onCopied}
        copyText={copyText}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '⧉ Copy prompt' }))
    expect(copyText).toHaveBeenCalledWith('copy me')
    expect(onCopied).toHaveBeenCalledTimes(1)
  })
})

describe('DecisionSection prompt generation wiring', () => {
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
  ]

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  function renderReady(sessionId = 'prompt-wiring-test') {
    const utils = render(
      <ReaderStateProvider sessionId={sessionId}>
        <DecisionSection decisions={decisions} no={1} docTitle="Rate Limiter" sessionId={sessionId} />
      </ReaderStateProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /KV/ }))
    return utils
  }

  it('"Generate prompt" opens the panel with the built prompt text', () => {
    renderReady()
    fireEvent.click(screen.getByRole('button', { name: /Generate prompt/ }))

    const textarea = screen.getByRole('textbox', { name: 'Prompt text' }) as HTMLTextAreaElement
    expect(textarea.value).toContain('Reply to the "Rate Limiter" doc (session prompt-wiring-test) - my decisions:')
    expect(textarea.value).toContain('[d1] Which cache?')
    expect(textarea.value).toContain('  - Choice: KV')
  })

  it('editing the textarea keeps the user text until Rebuild is clicked, even as the note field changes', () => {
    renderReady()
    fireEvent.click(screen.getByRole('button', { name: /Generate prompt/ }))

    const textarea = screen.getByRole('textbox', { name: 'Prompt text' }) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'my hand-edited prompt' } })
    expect(textarea.value).toBe('my hand-edited prompt')

    // A further store mutation (typing a note) does not touch the
    // already-open panel's independently-owned text.
    fireEvent.change(screen.getByPlaceholderText(/business reason/), {
      target: { value: 'a new note' },
    })
    expect(textarea.value).toBe('my hand-edited prompt')
  })

  it('"Rebuild from answers" replaces hand-edited text with a freshly regenerated prompt', () => {
    renderReady()
    fireEvent.click(screen.getByRole('button', { name: /Generate prompt/ }))

    const textarea = screen.getByRole('textbox', { name: 'Prompt text' }) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'stale hand-edited text' } })
    expect(textarea.value).toBe('stale hand-edited text')

    fireEvent.click(screen.getByRole('button', { name: '↻ Rebuild from answers' }))
    expect(textarea.value).toContain('[d1] Which cache?')
    expect(textarea.value).toContain('  - Choice: KV')
    expect(textarea.value).not.toContain('stale hand-edited text')
  })

  it('"Close" (✕) hides the panel without clearing answers', () => {
    renderReady()
    fireEvent.click(screen.getByRole('button', { name: /Generate prompt/ }))
    expect(screen.getByRole('textbox', { name: 'Prompt text' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close prompt review' }))
    expect(screen.queryByRole('textbox', { name: 'Prompt text' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /KV/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
