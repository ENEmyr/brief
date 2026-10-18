import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DecisionDock, DecisionSheet } from '@/features/decisions'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Decision, Section } from '@brief/schema'

const XSS = '<img src=x onerror="window.__xss=1">'

const sections: Section[] = [
  { id: 'intro', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'a' }] },
  { id: 'bucket', no: 2, title: 'Token bucket', blocks: [{ type: 'p', text: 'b' }] },
  { id: 'evil', no: 12, title: XSS, blocks: [{ type: 'p', text: 'c' }] },
]

const opts = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
]

const decisions: Decision[] = [
  { id: 'D1', q: 'Which limiter?', multi: false, opts, refs: ['bucket', 'missing', 'intro', 'bucket'] },
  { id: 'D2', q: 'No refs', multi: false, opts },
  { id: 'D3', q: 'Empty refs', multi: false, opts, refs: [] },
  { id: 'D4', q: 'Only broken refs', multi: false, opts, refs: ['gone'] },
  { id: 'D5', q: 'Hostile title', multi: false, opts, refs: ['evil'] },
]

function renderDock(onJump = vi.fn()) {
  render(
    <ReaderStateProvider sessionId="refs-test" persist={false}>
      <DecisionDock
        decisions={decisions}
        sections={sections}
        target={null}
        onCopyPrompt={() => {}}
        onJumpToContext={onJump}
      />
    </ReaderStateProvider>,
  )
  return onJump
}

const question = (id: string) => screen.getByRole('group', { name: `Question ${id}` })

describe('decision context chips (D7)', () => {
  it('shows one chip per resolvable ref, in ref order, without repeats', () => {
    renderDock()
    const links = within(question('D1')).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['§02Token bucket', '§01Intro'])
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['#bucket', '#intro'])
    expect(within(question('D1')).getByText('context')).toBeTruthy()
  })

  it('renders nothing for missing, empty or unresolvable refs', () => {
    renderDock()
    for (const id of ['D2', 'D3', 'D4']) {
      expect(within(question(id)).queryByRole('link')).toBeNull()
      expect(within(question(id)).queryByText('context')).toBeNull()
    }
  })

  it('reports the section and the decision when a chip is clicked', () => {
    const onJump = renderDock()
    fireEvent.click(within(question('D1')).getByRole('link', { name: '§01 Intro' }))
    expect(onJump).toHaveBeenCalledWith('intro', 'D1')
  })

  it('prints a section title as text, never as markup', () => {
    renderDock()
    const chip = within(question('D5')).getByRole('link')
    expect(chip.textContent).toBe(`§12${XSS}`)
    expect(chip.querySelector('img')).toBeNull()
  })

  it('shows the chips in the sheet for the current decision, without the label', () => {
    const onJump = vi.fn()
    render(
      <ReaderStateProvider sessionId="refs-sheet-test" persist={false}>
        <DecisionSheet
          decisions={decisions}
          sections={sections}
          target={{ id: 'D1', seq: 0 }}
          onSelect={() => {}}
          onCopyPrompt={() => {}}
          onJumpToContext={onJump}
        />
      </ReaderStateProvider>,
    )
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['§02Token bucket', '§01Intro'])
    expect(screen.queryByText('context')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: '§02 Token bucket' }))
    expect(onJump).toHaveBeenCalledWith('bucket', 'D1')
  })
})
