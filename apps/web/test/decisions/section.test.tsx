import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DecisionDock, DecisionSheet } from '@/features/decisions'
import type { DockTarget } from '@/features/decisions'
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

function renderDock(
  list: Decision[] = decisions,
  {
    target = null,
    onCopyPrompt = () => {},
  }: { target?: DockTarget | null; onCopyPrompt?: () => void } = {},
) {
  return render(
    <ReaderStateProvider sessionId="decisions-test" persist={false}>
      <DecisionDock decisions={list} target={target} onCopyPrompt={onCopyPrompt} />
    </ReaderStateProvider>,
  )
}

const question = (id: string) => screen.getByRole('group', { name: `Question ${id}` })
const count = () => screen.getByText(/^\d+\/\d+$/)

// jsdom has no layout, so it does not implement scrollIntoView.
const scrollIntoView = vi.fn()
beforeEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView
})

afterEach(() => {
  vi.restoreAllMocks()
  scrollIntoView.mockClear()
  delete (Element.prototype as Partial<Element>).scrollIntoView
})

describe('DecisionDock', () => {
  it('renders nothing when there are no decisions', () => {
    const { container } = renderDock([])
    expect(container.firstChild).toBeNull()
  })

  it('heads the dock with DECISIONS and the answered count', () => {
    renderDock()
    expect(screen.getByText('DECISIONS')).toBeInTheDocument()
    expect(count()).toHaveTextContent('0/2')
  })

  it('lists every decision at once, each named "Question <id>", with no stepper', () => {
    renderDock()
    expect(within(question('d1')).getByText('Which cache?')).toBeInTheDocument()
    expect(within(question('d2')).getByText('Which regions?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Previous|Next/ })).not.toBeInTheDocument()
  })

  it('names each decision by its full free-form id', () => {
    renderDock([
      { ...decisions[0]!, id: 'd1-reviewer-chain' },
      { ...decisions[1]!, id: 'd2-360-readiness' },
    ])
    expect(within(question('d1-reviewer-chain')).getByText('d1-reviewer-chain')).toBeInTheDocument()
    expect(question('d2-360-readiness')).toBeInTheDocument()
  })

  it('renders the detail sub-line only for options that have one, as the option description', () => {
    renderDock()
    expect(screen.getByRole('radio', { name: 'KV' })).toHaveAccessibleDescription(
      'Fast, eventually consistent',
    )
    expect(screen.getByRole('radio', { name: 'None' })).not.toHaveAccessibleDescription()
  })

  it('names each option by its label and announces its number as the key shortcut', () => {
    renderDock()
    expect(screen.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-keyshortcuts', '2')
    expect(screen.getByRole('radio', { name: 'Other, type your own' })).toHaveAttribute(
      'aria-keyshortcuts',
      '3',
    )
  })

  it('numbers the options and adds "Other, type your own" last', () => {
    renderDock()
    const options = within(question('d1')).getAllByRole('radio')
    expect(options.map((o) => o.textContent)).toEqual([
      '1KVFast, eventually consistent',
      '2None',
      '3Other, type your own',
    ])
    expect(
      within(question('d2'))
        .getAllByRole('checkbox')
        .map((o) => o.textContent),
    ).toEqual(['1US', '2EU', '3Other, type your own'])
  })

  it('says open, multi or done beside each question', () => {
    renderDock()
    expect(within(question('d1')).getByText('open')).toBeInTheDocument()
    expect(within(question('d2')).getByText('multi')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'None' }))
    expect(within(question('d1')).getByText('done')).toBeInTheDocument()
  })

  it('single-select: a radiogroup; picking an option checks it and bumps the answered count', () => {
    renderDock()
    const group = within(question('d1')).getByRole('radiogroup', { name: 'Which cache?' })
    const kv = within(group).getByRole('radio', { name: 'KV' })
    expect(kv).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(kv)

    expect(kv).toHaveAttribute('aria-checked', 'true')
    expect(count()).toHaveTextContent('1/2')
  })

  it('single-select: picking a second option replaces the first', () => {
    renderDock()
    fireEvent.click(screen.getByRole('radio', { name: 'KV' }))
    fireEvent.click(screen.getByRole('radio', { name: 'None' }))

    expect(screen.getByRole('radio', { name: 'KV' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true')
    expect(count()).toHaveTextContent('1/2')
  })

  it('single-select: arrow keys move to the next option and pick it, one tab stop', () => {
    renderDock()
    const [kv, none, other] = within(question('d1')).getAllByRole('radio')
    expect([kv, none, other].map((o) => o!.tabIndex)).toEqual([0, -1, -1])
    kv!.focus()
    fireEvent.keyDown(kv!, { key: 'ArrowDown' })
    expect(none).toHaveFocus()
    expect(none).toHaveAttribute('aria-checked', 'true')
    expect([kv, none, other].map((o) => o!.tabIndex)).toEqual([-1, 0, -1])
    fireEvent.keyDown(none!, { key: 'ArrowUp' })
    fireEvent.keyDown(kv!, { key: 'ArrowUp' })
    expect(other).toHaveFocus()
    expect(other).toHaveAttribute('aria-checked', 'true')
  })

  it('multi-select: checkboxes toggle independently without clearing sibling picks', () => {
    renderDock()
    const us = screen.getByRole('checkbox', { name: 'US' })
    const eu = screen.getByRole('checkbox', { name: 'EU' })

    fireEvent.click(us)
    fireEvent.click(eu)
    expect(us).toHaveAttribute('aria-checked', 'true')
    expect(eu).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(us)
    expect(us).toHaveAttribute('aria-checked', 'false')
    expect(eu).toHaveAttribute('aria-checked', 'true')
  })

  it('Other opens a focused "Your answer" field that keeps the text and counts as answered', () => {
    renderDock()
    expect(screen.queryByRole('textbox', { name: 'd1 Your answer' })).not.toBeInTheDocument()

    fireEvent.click(within(question('d1')).getByRole('radio', { name: 'Other, type your own' }))

    const field = screen.getByRole('textbox', { name: 'd1 Your answer' })
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('placeholder', 'Your answer')
    expect(count()).toHaveTextContent('1/2')
    fireEvent.change(field, { target: { value: 'Redis' } })
    expect(field).toHaveValue('Redis')
  })

  it('single-select: an agent option after Other closes the field; multi-select keeps both', () => {
    renderDock()
    fireEvent.click(within(question('d1')).getByRole('radio', { name: 'Other, type your own' }))
    fireEvent.click(screen.getByRole('radio', { name: 'None' }))
    expect(screen.queryByRole('textbox', { name: 'd1 Your answer' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'US' }))
    fireEvent.click(within(question('d2')).getByRole('checkbox', { name: 'Other, type your own' }))
    expect(screen.getByRole('checkbox', { name: 'US' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox', { name: 'd2 Your answer' })).toBeInTheDocument()
  })

  it('1 to 9 pick the numbered option in the focused question; the last number is Other', () => {
    renderDock()
    const none = screen.getByRole('radio', { name: 'None' })
    screen.getByRole('radio', { name: 'KV' }).focus()

    fireEvent.keyDown(document.activeElement!, { key: '2', code: 'Digit2' })
    expect(none).toHaveAttribute('aria-checked', 'true')
    expect(none).toHaveFocus()
    expect(screen.getByRole('checkbox', { name: 'US' })).toHaveAttribute('aria-checked', 'false')

    fireEvent.keyDown(document.activeElement!, { key: '3', code: 'Digit3' })
    expect(screen.getByRole('textbox', { name: 'd1 Your answer' })).toHaveFocus()
  })

  it('a number key picks in a later question too, not only the first one', () => {
    renderDock()
    screen.getByRole('checkbox', { name: 'US' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: '2', code: 'Digit2' })
    expect(screen.getByRole('checkbox', { name: 'EU' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(document.activeElement!, { key: '3', code: 'Digit3' })
    expect(screen.getByRole('textbox', { name: 'd2 Your answer' })).toHaveFocus()
  })

  it('a number key does nothing outside a question, or inside its text fields', () => {
    renderDock()
    fireEvent.keyDown(document.body, { key: '1', code: 'Digit1' })
    expect(count()).toHaveTextContent('0/2')

    const reason = screen.getByRole('textbox', { name: 'd1 Reason' })
    reason.focus()
    fireEvent.keyDown(reason, { key: '1', code: 'Digit1' })
    expect(screen.getByRole('radio', { name: 'KV' })).toHaveAttribute('aria-checked', 'false')
  })

  it('a number key on a Thai layout picks by the physical digit', () => {
    renderDock()
    screen.getByRole('radio', { name: 'KV' }).focus()
    // Thai Kedmanee: the 2 key types "/", the 1 key types "ๅ".
    fireEvent.keyDown(document.activeElement!, { key: '/', code: 'Digit2' })
    expect(screen.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(document.activeElement!, { key: 'ๅ', code: 'Digit1' })
    expect(screen.getByRole('radio', { name: 'KV' })).toHaveAttribute('aria-checked', 'true')
  })

  it('every question has its own reason field', () => {
    renderDock()
    const reason1 = screen.getByRole('textbox', { name: 'd1 Reason' })
    expect(reason1).toHaveAttribute('placeholder', 'Reason / extra context (optional)')
    fireEvent.change(reason1, { target: { value: 'needs low latency' } })
    expect(reason1).toHaveValue('needs low latency')
    expect(screen.getByRole('textbox', { name: 'd2 Reason' })).toHaveValue('')
  })

  it('keeps a reason saved over several lines when the reader types more', () => {
    localStorage.setItem(
      'idocs:decisions-multiline',
      JSON.stringify({ highlights: [], dsel: {}, dnote: { d1: 'a\nb' } }),
    )
    render(
      <ReaderStateProvider sessionId="decisions-multiline">
        <DecisionDock decisions={decisions} target={null} onCopyPrompt={() => {}} />
      </ReaderStateProvider>,
    )
    const reason = screen.getByRole('textbox', { name: 'd1 Reason' })
    expect(reason).toHaveValue('a\nb')
    fireEvent.change(reason, { target: { value: `${(reason as HTMLTextAreaElement).value}c` } })
    expect(reason).toHaveValue('a\nbc')
    localStorage.clear()
  })

  it('counts reasons in the footer line, the Note lines the prompt prints', () => {
    renderDock()
    expect(screen.getByText('Includes answers, reasons and 0 notes')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'd1 Reason' }), {
      target: { value: 'why' },
    })
    expect(screen.getByText('Includes answers, reasons and 1 note')).toBeInTheDocument()
  })

  it('Copy prompt for agent works with open questions', () => {
    const onCopyPrompt = vi.fn()
    renderDock(decisions, { onCopyPrompt })
    expect(screen.queryByText(/more to generate a prompt/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Copy prompt for agent/ }))
    expect(onCopyPrompt).toHaveBeenCalledTimes(1)
  })

  it('shows the mod key chip on Copy prompt for agent', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    renderDock()
    expect(screen.getByRole('button', { name: /^Copy prompt for agent/ })).toHaveTextContent(
      'Copy prompt for agent⌘↵',
    )
  })

  it('reset clears every answer, Other answer and reason, and only shows once something is touched', () => {
    renderDock()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'KV' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'd1 Reason' }), {
      target: { value: 'some note' },
    })
    fireEvent.click(within(question('d2')).getByRole('checkbox', { name: 'Other, type your own' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'd2 Your answer' }), {
      target: { value: 'APAC' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    expect(count()).toHaveTextContent('0/2')
    expect(screen.getByRole('radio', { name: 'KV' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('textbox', { name: 'd1 Reason' })).toHaveValue('')
    expect(screen.queryByRole('textbox', { name: 'd2 Your answer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
  })

  it('reset shows for a reason alone, since it clears reasons too', () => {
    renderDock()
    fireEvent.change(screen.getByRole('textbox', { name: 'd2 Reason' }), {
      target: { value: 'later' },
    })
    expect(screen.getByRole('button', { name: 'Reset' })).toHaveAttribute(
      'title',
      'Clear all answers',
    )
  })

  it('a reason of only spaces is not something to reset', () => {
    renderDock()
    fireEvent.change(screen.getByRole('textbox', { name: 'd2 Reason' }), {
      target: { value: '   ' },
    })
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
    expect(screen.getByText('Includes answers, reasons and 0 notes')).toBeInTheDocument()
  })

  it('a new target scrolls its question, then its tab stop, into view and focuses the tab stop', () => {
    const { rerender } = renderDock()
    expect(scrollIntoView).not.toHaveBeenCalled()
    rerender(
      <ReaderStateProvider sessionId="decisions-test" persist={false}>
        <DecisionDock decisions={decisions} target={{ id: 'd2', seq: 1 }} onCopyPrompt={() => {}} />
      </ReaderStateProvider>,
    )
    const tabStop = screen.getByRole('checkbox', { name: 'US' })
    expect(scrollIntoView.mock.calls).toEqual([[{ block: 'nearest' }], [{ block: 'nearest' }]])
    expect(scrollIntoView.mock.contexts).toEqual([question('d2'), tabStop])
    expect(tabStop).toHaveFocus()
  })

  it('renders no support tab strip when no question has why/cmp/dia', () => {
    renderDock()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})

describe('DecisionSheet', () => {
  // Wraps the sheet the way the reader does: inside the dock's own dialog, a
  // chip keeps the request number and "show d2" (N, Go to) raises it.
  function renderSheet(onCopyPrompt = () => {}) {
    function Harness() {
      const [target, setTarget] = useState<DockTarget | null>(null)
      return (
        <ReaderStateProvider sessionId="decisions-test" persist={false}>
          <aside id="dock" role="dialog" aria-modal="true" aria-label="Decision dock" data-dock="">
            <DecisionSheet
              decisions={decisions}
              target={target}
              onSelect={(id) => setTarget((prev) => ({ id, seq: prev?.seq ?? 0 }))}
              onCopyPrompt={onCopyPrompt}
            />
          </aside>
          <button
            type="button"
            onClick={() => setTarget((prev) => ({ id: 'd2', seq: (prev?.seq ?? 0) + 1 }))}
          >
            show d2
          </button>
        </ReaderStateProvider>
      )
    }
    return render(<Harness />)
  }

  const chip = (id: string) => screen.getByRole('button', { name: `Question ${id}` })

  it('shows one chip per question and the first question alone when nothing is targeted', () => {
    renderSheet()
    expect(chip('d1')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('d2')).toHaveAttribute('aria-pressed', 'false')
    expect(within(question('d1')).getByText('Which cache?')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Question d2' })).not.toBeInTheDocument()
  })

  it('an answered chip shows a check and says answered, keeping its name', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('radio', { name: 'KV' }))
    expect(chip('d1')).toHaveTextContent('d1 ✓')
    expect(chip('d1')).toHaveAccessibleDescription('answered')
    expect(chip('d2')).toHaveTextContent(/^d2$/)
    expect(chip('d2')).toHaveAccessibleDescription('')
  })

  it('a chip switches the question and keeps focus on the chip', () => {
    renderSheet()
    chip('d2').focus()
    fireEvent.click(chip('d2'))
    expect(within(question('d2')).getByText('Which regions?')).toBeInTheDocument()
    expect(chip('d2')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('d2')).toHaveFocus()
  })

  it('a new target shows that question and focuses its first option', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'show d2' }))
    expect(within(question('d2')).getByRole('checkbox', { name: 'US' })).toHaveFocus()
  })

  it('options are 1 to 9 here too, Other last, inside the dock sheet', () => {
    renderSheet()
    screen.getByRole('radio', { name: 'KV' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: '2', code: 'Digit2' })
    expect(screen.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(document.activeElement!, { key: '3', code: 'Digit3' })
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveFocus()
  })

  it('keeps a reason per question under its label', () => {
    renderSheet()
    const reason = screen.getByRole('textbox', { name: 'Reason / extra context' })
    expect(reason).toHaveAttribute('placeholder', 'optional')
    fireEvent.change(reason, { target: { value: 'cheaper' } })
    fireEvent.click(chip('d2'))
    expect(screen.getByRole('textbox', { name: 'Reason / extra context' })).toHaveValue('')
    fireEvent.click(chip('d1'))
    expect(screen.getByRole('textbox', { name: 'Reason / extra context' })).toHaveValue('cheaper')
  })

  it('Copy prompt for agent hands off to the reader', () => {
    const onCopyPrompt = vi.fn()
    renderSheet(onCopyPrompt)
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt for agent' }))
    expect(onCopyPrompt).toHaveBeenCalledTimes(1)
  })
})
