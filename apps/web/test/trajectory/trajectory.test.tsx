import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Payload, TrajectoryBlock } from '@brief/schema'
import { buildEditPrompt } from '@/features/annotations'
import { buildReplyPrompt } from '@/features/decisions'
import { BlockRenderer } from '@/features/reader'
import { createReaderStateStore, ReaderStateProvider, type ReaderState } from '@/features/reader-state'
import { durationLabel, flagPromptLines, offsetLabel, tokensLabel, trailFlagCount } from '@/features/trajectory'

const trajectory: TrajectoryBlock = {
  type: 'trajectory',
  stats: { seconds: 252, tokens: 38200 },
  steps: [
    { at: '2026-10-15T01:00:00Z', kind: 'request', title: 'Do not touch the webhook endpoints', detail: 'first prompt' },
    { at: '2026-10-15T01:00:14Z', kind: 'read', title: 'src/router.ts, wrangler.toml' },
    { at: '2026-10-15T01:00:52Z', kind: 'decision', title: 'key = API key, fallback IP', flag: true },
    { at: '2026-10-15T01:01:30Z', kind: 'edit', title: 'src/limiter.ts' },
    { at: '2026-10-15T01:02:05Z', kind: 'assumption', title: 'Webhooks come from a fixed IP range', flag: true },
    { at: '2026-10-15T01:03:40Z', kind: 'run', title: 'k6 run burst.js' },
  ],
}

const payload: Payload = {
  meta: { title: 'Rate Limiter', version: '1.0.0' },
  sections: [
    { id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello' }, trajectory] },
    { id: 's2', no: 2, title: 'Later', blocks: [{ type: 'details', summary: 'Trail', blocks: [trajectory] }] },
  ],
  decisions: [],
}

function state(tflag: ReaderState['tflag']): ReaderState {
  return { highlights: [], dsel: {}, dnote: {}, dother: {}, tflag }
}

describe('trajectory labels', () => {
  it('shows each step as an offset from the first', () => {
    expect(offsetLabel('2026-10-15T01:00:14Z', '2026-10-15T01:00:00Z')).toBe('00:14')
    expect(offsetLabel('2026-10-15T01:03:40.400Z', '2026-10-15T01:00:00Z')).toBe('03:40')
    expect(offsetLabel('2026-10-15T02:02:05Z', '2026-10-15T01:00:00Z')).toBe('1:02:05')
    expect(offsetLabel('2026-10-15T00:59:46Z', '2026-10-15T01:00:00Z')).toBe('-00:14')
  })

  it('formats the header totals the way the board does', () => {
    expect(durationLabel(252)).toBe('4m 12s')
    expect(durationLabel(42)).toBe('42s')
    expect(durationLabel(3720)).toBe('1h 2m')
    expect(tokensLabel(38200)).toBe('38.2k tokens')
    expect(tokensLabel(38000)).toBe('38k tokens')
    expect(tokensLabel(980)).toBe('980 tokens')
  })
})

describe('flagPromptLines', () => {
  it('lists each marked flagged step, top-level and nested, in document order', () => {
    expect(flagPromptLines(payload, state({ '0.1': { '2': 'ask' }, '1.0.blocks.0': { '4': 'ok' } }))).toEqual([
      'Flags (steps the agent decided alone or assumed):',
      '  - Ask me: 00:52 decided - key = API key, fallback IP',
      '  - OK: 02:05 assumed - Webhooks come from a fixed IP range',
      '',
    ])
  })

  it('prints nothing without marks, and ignores a mark on a step that is not flagged or not there', () => {
    expect(flagPromptLines(payload, state(undefined))).toEqual([])
    expect(flagPromptLines(payload, state({ '0.1': { '1': 'ask', '99': 'ok' }, '5.5': { '0': 'ask' } }))).toEqual([])
  })

  it('puts the marks into both copy-back prompts', () => {
    const marked = state({ '0.1': { '2': 'ask' } })
    const edit = buildEditPrompt(payload, marked, 'sess1', 'https://example.com', false)
    expect(edit).toContain('  - Ask me: 00:52 decided - key = API key, fallback IP')
    const reply = buildReplyPrompt([], marked, 'Rate Limiter', 'sess1', flagPromptLines(payload, marked))
    expect(reply).toContain('  - Ask me: 00:52 decided - key = API key, fallback IP')
  })

  it('lets an edit prompt with only a mark through the nothing-to-act-on guard', () => {
    expect(buildEditPrompt(payload, state(undefined), 'sess1', 'https://example.com', false)).toBeNull()
    expect(buildEditPrompt(payload, state({ '0.1': { '4': 'ok' } }), 'sess1', 'https://example.com', false)).not.toBeNull()
  })
})

describe('tflag reader state', () => {
  beforeEach(() => localStorage.clear())

  it('sets, replaces and clears a mark, and survives a reload from localStorage', async () => {
    const store = createReaderStateStore('traj1')
    store.actions.setStepMark('0.1', 2, 'ask')
    store.actions.setStepMark('0.1', 4, 'ok')
    store.actions.setStepMark('0.1', 4, 'ask')
    expect(store.getState().tflag).toEqual({ '0.1': { '2': 'ask', '4': 'ask' } })
    store.actions.setStepMark('0.1', 2, null)
    store.actions.setStepMark('0.1', 4, null)
    expect(store.getState().tflag).toEqual({})

    store.actions.setStepMark('1.0.blocks.0', 2, 'ok')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(createReaderStateStore('traj1').getState().tflag).toEqual({ '1.0.blocks.0': { '2': 'ok' } })
  })

  it('drops a stored mark that is not ask or ok, or not on a step index', () => {
    localStorage.setItem(
      'idocs:traj2',
      JSON.stringify({ highlights: [], dsel: {}, dnote: {}, dother: {}, tflag: { '0.1': { '2': 'yes', x: 'ok', '3': 'ok' }, '0.2': 'ask' } }),
    )
    expect(createReaderStateStore('traj2').getState().tflag).toEqual({ '0.1': { '3': 'ok' } })
  })

  it('keeps marks when the decisions are reset', () => {
    const store = createReaderStateStore('traj3')
    store.actions.setStepMark('0.1', 2, 'ask')
    store.actions.resetDecisions()
    expect(store.getState().tflag).toEqual({ '0.1': { '2': 'ask' } })
  })
})

describe('Trajectory block', () => {
  beforeEach(() => localStorage.clear())

  function renderBlock() {
    return render(
      <ReaderStateProvider sessionId="traj-ui">
        <BlockRenderer block={trajectory} sid={0} bid={1} />
      </ReaderStateProvider>,
    )
  }

  it('draws the header counts, the offsets with the UTC time in a title, and Ask me / OK only on flagged steps', () => {
    renderBlock()
    for (const text of ['6 steps', '4m 12s', '38.2k tokens', '1 decided alone', '1 assumption']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    const offset = screen.getByText('00:52')
    expect(offset.tagName).toBe('TIME')
    expect(offset).toHaveAttribute('title', '2026-10-15T01:00:52Z')
    expect(screen.getAllByRole('button', { name: 'Ask me' })).toHaveLength(2)
  })

  it('filters by click and by arrow keys', () => {
    renderBlock()
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs).toEqual(['all 6', 'decided 1', 'assumed 1', 'edits 1', 'reads + bash 2'])
    fireEvent.click(screen.getByRole('tab', { name: 'reads + bash 2' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).queryByText('src/limiter.ts')).toBeNull()
    expect(within(panel).getByText('k6 run burst.js')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('tab', { name: 'reads + bash 2' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'all 6' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'all 6' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'all 6' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'decided 1' })).toHaveAttribute('aria-selected', 'true')
    expect(within(panel).getByText('key = API key, fallback IP')).toBeInTheDocument()
    expect(within(panel).queryByText('src/router.ts, wrangler.toml')).toBeNull()
  })

  it('marks a step, shows it pressed, and clears it on a second press', () => {
    renderBlock()
    const group = screen.getByRole('group', { name: 'key = API key, fallback IP' })
    const ask = within(group).getByRole('button', { name: 'Ask me' })
    fireEvent.click(ask)
    expect(ask).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(group).getByRole('button', { name: 'OK' }))
    expect(ask).toHaveAttribute('aria-pressed', 'false')
    expect(within(group).getByRole('button', { name: 'OK' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(group).getByRole('button', { name: 'OK' }))
    expect(within(group).getByRole('button', { name: 'OK' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('trailFlagCount', () => {
  const plain: Payload = { ...payload, sections: [{ id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello' }] }] }

  it('is null when the document has no trajectory block', () => {
    expect(trailFlagCount(plain)).toBeNull()
  })

  it('counts the flagged steps of every trajectory block, including one inside a details', () => {
    expect(trailFlagCount(payload)).toBe(4)
  })

  it('is 0 for a trajectory block with no flagged step', () => {
    const unflagged: TrajectoryBlock = { ...trajectory, steps: trajectory.steps.map(({ at, kind, title }) => ({ at, kind, title })) }
    const sections = [{ id: 's1', no: 1, title: 'Intro', blocks: [unflagged] }]
    expect(trailFlagCount({ ...plain, sections })).toBe(0)
  })
})
