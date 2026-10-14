import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import type { Block } from '@brief/schema'

import { DiagramViewerProvider } from '@/features/diagram-viewer'
import { PLAYBACK_STEP_MS } from '@/features/reader/components/blocks/Seq'

const seqBlock: Extract<Block, { type: 'seq' }> = {
  type: 'seq',
  title: 'Rate limit flow',
  actors: ['Client', 'Limiter', 'API', 'Cache'],
  steps: [
    { from: 'Client', to: 'Limiter', label: 'request' },
    { from: 'Limiter', to: 'Limiter', label: 'check token' },
    { from: 'Limiter', to: 'API', label: 'forward' },
    { from: 'Limiter', to: 'Client', label: '429', note: 'when exhausted' },
    { from: 'Limiter', to: 'Cache', label: 'read' },
  ],
}

const stateBlock: Extract<Block, { type: 'state' }> = {
  type: 'state',
  title: 'Request lifecycle',
  initial: 'queued',
  states: [
    { id: 'queued', label: 'Queued' },
    { id: 'checking', label: 'Checking' },
    { id: 'allowed', label: 'Allowed' },
    { id: 'rejected', label: 'Rejected' },
  ],
  transitions: [
    { from: 'queued', to: 'checking', label: 'start' },
    { from: 'checking', to: 'allowed', label: 'pass' },
    { from: 'checking', to: 'rejected', label: 'fail' },
  ],
}

const r = (block: Block) => render(<BlockRenderer block={block} />)

const edges = (container: HTMLElement) => Array.from(container.querySelectorAll<SVGGElement>('[data-edge]'))
const states = (container: HTMLElement) => edges(container).map((e) => e.getAttribute('data-state'))
const button = (name: string) => screen.getByRole('button', { name })

afterEach(() => vi.useRealTimers())

// Phase 4b redrew seq to B-Blocks:74-110 and B-Reader:126-139: HTML actor
// boxes and labels over an SVG edge layer, a rest state with every message
// drawn, and playback in the header (Play, Prev, Next) with a step list. The
// tests below that pinned the old SVG and the "step n/max" Prev/Next row now
// pin the same behaviour in the new drawing; each says what changed.
describe('Seq block', () => {
  it('renders an actor box and lifeline per actor, evenly spaced across a content-sized canvas', () => {
    // Was: rects and `line[stroke-dasharray="3 3"]` in one svg. Now: one box per
    // actor (B-Blocks:89-92) and a 3 4 dashed lifeline path per actor (:79-82).
    const { container } = r(seqBlock)
    const boxes = Array.from(container.querySelectorAll<HTMLElement>('[data-actor]'))
    expect(boxes.map((b) => b.textContent)).toEqual(seqBlock.actors)
    const lifelines = Array.from(container.querySelectorAll('path[stroke-dasharray="3 4"]'))
    expect(lifelines).toHaveLength(seqBlock.actors.length)

    const xs = lifelines.map((l) => Number(/^M([\d.]+)/.exec(l.getAttribute('d') ?? '')?.[1]))
    const lanes = xs.slice(1).map((x, i) => x - (xs[i] as number))
    lanes.forEach((lane) => expect(lane).toBe(160))
    const canvas = boxes[0]?.parentElement as HTMLElement
    expect(xs[xs.length - 1]).toBeLessThan(Number(canvas.style.width.replace('px', '')))
  })

  it('renders the diagram caption from block.title', () => {
    r(seqBlock)
    expect(screen.getByText('Rate limit flow')).toBeInTheDocument()
  })

  it('starts at rest: every message drawn, none current, the list hidden, Play in the header', () => {
    // Was "step 5/5" in the bottom row. The rest state of B-Reader:126-139
    // draws every message with no current step, and the header shows Play.
    const { container } = r(seqBlock)
    expect(states(container)).toEqual(['rest', 'rest', 'rest', 'rest', 'rest'])
    expect(button('Play sequence')).toBeInTheDocument()
    expect(screen.getByRole('list').className).toMatch(/(^| )hidden( |$)/)
    expect(screen.queryByText(/^step \d/)).not.toBeInTheDocument()
  })

  it('Prev and Next step through the messages and clamp at the first and last', () => {
    // Was "‹ Prev" / "Next ›" text buttons from step 5 down to 0. The header
    // icon buttons (B-Blocks:75) start at the first message and stop at 1 and n.
    r(seqBlock)
    expect(button('Previous step')).toBeDisabled()
    fireEvent.click(button('Next step'))
    expect(screen.getByText('step 1 / 5')).toBeInTheDocument()
    expect(button('Previous step')).toBeDisabled()

    for (let i = 0; i < 10; i++) fireEvent.click(button('Next step'))
    expect(screen.getByText('step 5 / 5')).toBeInTheDocument()
    expect(button('Next step')).toBeDisabled()

    for (let i = 0; i < 10; i++) fireEvent.click(button('Previous step'))
    expect(screen.getByText('step 1 / 5')).toBeInTheDocument()
  })

  it('marks earlier messages past, the current one lime and later ones future', () => {
    // Was opacity 0.2 on steps at or past the cursor. B-Blocks:83-98 colors by
    // phase instead: past faint, current accent, future line2.
    const { container } = r(seqBlock)
    for (let i = 0; i < 3; i++) fireEvent.click(button('Next step'))
    expect(states(container)).toEqual(['past', 'past', 'current', 'future', 'future'])
    expect(edges(container)[2]?.getAttribute('class')).toContain('stroke-accent-line')
    expect(edges(container)[0]?.getAttribute('class')).toContain('stroke-faint')
    expect(edges(container)[4]?.getAttribute('class')).toContain('stroke-line2')
  })

  it('renders a self-message loop distinctly for from === to steps', () => {
    // Was the literal path "h26 v16 h-26". The loop is now an edge with four
    // points: out 26, down 16, back with its head on the lifeline.
    const { container } = r(seqBlock)
    const loop = edges(container)[1]?.querySelector('path')
    expect(loop?.getAttribute('d')?.match(/[ML]/g)).toHaveLength(4)
  })

  it('skips steps referencing unknown actors instead of crashing', () => {
    // Was "step 1/1". The dropped step leaves one message and one list row.
    const block: Extract<Block, { type: 'seq' }> = {
      type: 'seq',
      actors: ['A', 'B'],
      steps: [
        { from: 'A', to: 'B', label: 'ok' },
        { from: 'A', to: 'Ghost', label: 'bad' },
      ],
    }
    let container!: HTMLElement
    expect(() => ({ container } = r(block))).not.toThrow()
    expect(edges(container)).toHaveLength(1)
    expect(screen.getByText('1 message', { exact: false })).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1)
  })

  it('shows only the seq kind tag when no title is given', () => {
    // The fallback caption 'Sequence' is gone: the kind tag names the block
    // (B-Blocks:75, B-Reader:126), and an untitled block shows no invented caption.
    const untitled: Extract<Block, { type: 'seq' }> = { ...seqBlock }
    delete untitled.title
    r(untitled)
    expect(screen.getByText('seq')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('Sequence')).not.toBeInTheDocument()
  })

  it('draws a reply dashed: a message back over a pair an earlier one went forward on', () => {
    const { container } = r(seqBlock)
    const dashes = edges(container).map((e) => e.querySelector('path')?.getAttribute('stroke-dasharray'))
    expect(dashes).toEqual([null, null, null, '6 5', null])
  })

  it('numbers every label and counts the messages in the caption (B-Blocks:75, :93)', () => {
    r(seqBlock)
    expect(screen.getByText('seq').nextElementSibling).toHaveTextContent('Rate limit flow / 5 messages')
    expect(screen.getByText('1 request')).toBeInTheDocument()
    expect(screen.getByText('4 429')).toBeInTheDocument()
  })

  it('plays one message every 1.6s, then stops on the last with Play to replay', () => {
    vi.useFakeTimers()
    const { container } = r(seqBlock)
    fireEvent.click(button('Play sequence'))
    expect(states(container)[0]).toBe('current')
    expect(button('Pause')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(PLAYBACK_STEP_MS))
    expect(states(container)[1]).toBe('current')
    for (let i = 0; i < 10; i++) act(() => vi.advanceTimersByTime(PLAYBACK_STEP_MS))
    expect(states(container)[4]).toBe('current')
    expect(button('Play sequence')).toBeInTheDocument()
  })

  it('Pause holds the current message', () => {
    vi.useFakeTimers()
    const { container } = r(seqBlock)
    fireEvent.click(button('Play sequence'))
    fireEvent.click(button('Pause'))
    act(() => vi.advanceTimersByTime(PLAYBACK_STEP_MS * 3))
    expect(states(container)[0]).toBe('current')
  })

  it('steps with Left and Right and toggles playback with Space on the focused diagram', () => {
    const { container } = r(seqBlock)
    const region = screen.getByRole('group', { name: 'Sequence steps' })
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(states(container)[1]).toBe('current')
    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(states(container)[0]).toBe('current')
    fireEvent.keyDown(region, { key: ' ' })
    expect(button('Pause')).toBeInTheDocument()
  })

  it('lists every step as "from → to: label" with the note under the current one', () => {
    r(seqBlock)
    for (let i = 0; i < 4; i++) fireEvent.click(button('Next step'))
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      '1Client → Limiter: request',
      '2Limiter → Limiter: check token',
      '3Limiter → API: forward',
      '4Limiter → Client: 429when exhausted',
      '5Limiter → Cache: read',
    ])
    expect(rows[3]).toHaveAttribute('aria-current', 'step')
  })

  it('gives the viewer its steps: the label, the step text and working Prev and Next', () => {
    render(
      <DiagramViewerProvider>
        <BlockRenderer block={seqBlock} />
      </DiagramViewerProvider>,
    )
    fireEvent.click(button('Next step'))
    fireEvent.click(button('Open diagram full screen'))
    const viewer = screen.getByRole('dialog', { name: 'Diagram viewer' })
    expect(within(viewer).getByRole('group', { name: 'Steps' })).toHaveTextContent('1 / 5')
    expect(within(viewer).getByText('Client → Limiter: request')).toBeInTheDocument()

    fireEvent.click(within(viewer).getByRole('button', { name: 'Next step' }))
    expect(within(viewer).getByText('Limiter → Limiter: check token')).toBeInTheDocument()
    expect(screen.getByText('step 2 / 5')).toBeInTheDocument()
  })
})

// StateMachine was redrawn to B-Blocks2:27-49. Owner ruling D5 removed the
// event simulation and its reset; the board dims unconnected states on hover.
describe('StateMachine block', () => {
  const nodes = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('[data-state-node]'))

  it('renders a node per state and tags the initial one (B-Blocks2:36)', () => {
    // Was "marks the initial state as current" (the simulation's start).
    const { container } = r(stateBlock)
    expect(nodes(container).map((n) => n.getAttribute('data-state-node'))).toEqual([
      'queued',
      'checking',
      'allowed',
      'rejected',
    ])
    expect(nodes(container)[0]).toHaveTextContent('Queuedinitial')
    expect(nodes(container)[0]?.className).toContain('border-accent-line')
  })

  it('renders the diagram caption from block.title', () => {
    r(stateBlock)
    expect(screen.getByText('Request lifecycle', { exact: false })).toBeInTheDocument()
  })

  it('has no event buttons; hovering a state dims every state not connected to it', () => {
    // Was: clicking "start" moved the current state. D5 removed the events.
    const { container } = r(stateBlock)
    expect(screen.queryByRole('button', { name: 'start' })).not.toBeInTheDocument()
    act(() => {
      fireEvent.pointerEnter(nodes(container)[0] as HTMLElement)
    })
    const dimmed = nodes(container).map((n) => n.className.includes('opacity-45'))
    expect(dimmed).toEqual([false, false, true, true])
    act(() => {
      fireEvent.pointerLeave(nodes(container)[0] as HTMLElement)
    })
    expect(nodes(container).some((n) => n.className.includes('opacity-45'))).toBe(false)
  })

  it('has no reset button, and draws a state with no way out as final (B-Blocks2:40)', () => {
    // Was: reaching a terminal state showed "↺ reset". D5 removed it.
    const { container } = r(stateBlock)
    expect(screen.queryByRole('button', { name: '↺ reset' })).not.toBeInTheDocument()
    const finals = nodes(container).filter((n) => n.textContent?.endsWith('final'))
    expect(finals.map((n) => n.getAttribute('data-state-node'))).toEqual(['allowed', 'rejected'])
    expect(finals[0]?.className).toContain('border-double')
  })

  it('draws an unlabeled transition as a bare edge', () => {
    // Was an event button "to {target}"; with no simulation the edge carries no label.
    const block: Extract<Block, { type: 'state' }> = {
      type: 'state',
      initial: 'a',
      states: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      transitions: [{ from: 'a', to: 'b' }],
    }
    const { container } = r(block)
    expect(edges(container)).toHaveLength(1)
    expect(screen.queryByText('to b')).not.toBeInTheDocument()
  })

  it('skips transitions referencing unknown state ids instead of crashing', () => {
    // Was asserted on the event buttons; now on the drawn edges and labels.
    const block: Extract<Block, { type: 'state' }> = {
      type: 'state',
      initial: 'a',
      states: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      transitions: [
        { from: 'a', to: 'b', label: 'go' },
        { from: 'a', to: 'ghost', label: 'bad' },
      ],
    }
    let container!: HTMLElement
    expect(() => ({ container } = r(block))).not.toThrow()
    expect(edges(container)).toHaveLength(1)
    expect(screen.getByText('go')).toBeInTheDocument()
    expect(screen.queryByText('bad')).not.toBeInTheDocument()
  })

  it('shows only the state kind tag when no title is given', () => {
    // The fallback caption 'State machine' is gone: the kind tag names the
    // block (B-Blocks2:28), and an untitled block shows no invented caption.
    const untitled: Extract<Block, { type: 'state' }> = { ...stateBlock }
    delete untitled.title
    r(untitled)
    expect(screen.getByText('state')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('State machine')).not.toBeInTheDocument()
  })

  it('colors a transition into a final state good and a loop back warn and dashed (B-Blocks2:33, :35)', () => {
    const block: Extract<Block, { type: 'state' }> = {
      type: 'state',
      initial: 'a',
      states: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      transitions: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
        { from: 'b', to: 'c' },
      ],
    }
    const { container } = r(block)
    const classes = edges(container).map((e) => e.getAttribute('class') ?? '')
    expect(classes[0]).toContain('stroke-sub')
    expect(classes[1]).toContain('stroke-warn')
    expect(edges(container)[1]?.querySelector('path')?.getAttribute('stroke-dasharray')).toBe('6 5')
    expect(classes[2]).toContain('stroke-good')
  })

  it('fits a long Thai or English label inside its node by wrapping it', () => {
    // evidence/u04 answer 6: labels ran out of a fixed 74px node.
    const block: Extract<Block, { type: 'state' }> = {
      type: 'state',
      initial: 'a',
      states: [
        { id: 'a', label: 'รอการอนุมัติจากผู้อำนวยการสำนักบริหารทรัพยากรบุคคล' },
        { id: 'b', label: 'Waiting for the regional director to approve the request' },
      ],
      transitions: [{ from: 'a', to: 'b' }],
    }
    const { container } = r(block)
    for (const node of nodes(container)) {
      expect(node.style.width).toBe('160px')
      const lines = node.querySelectorAll(':scope > span > span.block:not(.font-mono)').length
      expect(lines).toBeGreaterThan(1)
      // Lines of 16px plus 6px padding top and bottom, and the tag line.
      expect(Number(node.style.height.replace('px', ''))).toBeGreaterThanOrEqual(lines * 16 + 12)
    }
  })
})
