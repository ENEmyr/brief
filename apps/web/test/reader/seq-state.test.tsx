import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import type { Block } from '@brief/schema'

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

describe('Seq block', () => {
  it('renders an actor box and lifeline per actor, evenly spaced across a content-sized viewBox', () => {
    const { container } = r(seqBlock)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg?.querySelectorAll('rect').length).toBeGreaterThanOrEqual(seqBlock.actors.length)
    const lifelines = Array.from(svg?.querySelectorAll('line[stroke-dasharray="3 3"]') ?? [])
    expect(lifelines.length).toBe(seqBlock.actors.length)

    const xs = lifelines.map((l) => Number(l.getAttribute('x1')))
    const lanes = xs.slice(1).map((x, i) => x - (xs[i] as number))
    lanes.forEach((lane) => expect(lane).toBeCloseTo(lanes[0] as number, 5))
    expect(lanes[0]).toBeGreaterThan(0)
    // The last lifeline stays inside the diagram the layout actually sized.
    expect(xs[xs.length - 1]).toBeLessThan(Number(svg?.getAttribute('width')))

    seqBlock.actors.forEach((a) => expect(screen.getAllByText(a).length).toBeGreaterThan(0))
  })

  it('renders the diagram caption from block.title', () => {
    r(seqBlock)
    expect(screen.getByText('Rate limit flow')).toBeInTheDocument()
  })

  it('starts with all steps fully visible (step = steps.length)', () => {
    r(seqBlock)
    expect(screen.getByText('step 5/5')).toBeInTheDocument()
  })

  it('Prev/Next controls step through opacity and clamp at bounds', () => {
    r(seqBlock)
    const prev = screen.getByRole('button', { name: '‹ Prev' })
    const next = screen.getByRole('button', { name: 'Next ›' })

    expect(next).toBeDisabled()
    fireEvent.click(prev)
    expect(screen.getByText('step 4/5')).toBeInTheDocument()
    expect(next).not.toBeDisabled()

    for (let i = 0; i < 10; i++) fireEvent.click(prev)
    expect(screen.getByText('step 0/5')).toBeInTheDocument()
    expect(prev).toBeDisabled()

    for (let i = 0; i < 10; i++) fireEvent.click(next)
    expect(screen.getByText('step 5/5')).toBeInTheDocument()
    expect(next).toBeDisabled()
  })

  it('fades out steps at or beyond the current step index', () => {
    const { container } = r(seqBlock)
    const prev = screen.getByRole('button', { name: '‹ Prev' })
    fireEvent.click(prev)
    fireEvent.click(prev)
    fireEvent.click(prev)
    // step is now 2: steps[0] and steps[1] visible, steps[2..] faded
    const groups = container.querySelectorAll('svg > g')
    const stepGroups = Array.from(groups).slice(seqBlock.actors.length)
    expect(stepGroups[0]?.getAttribute('style')).not.toContain('opacity: 0.2')
    expect(stepGroups[2]?.getAttribute('style')).toContain('opacity: 0.2')
  })

  it('renders a self-message loop distinctly for from === to steps', () => {
    const { container } = r(seqBlock)
    const svg = container.querySelector('svg')
    const loopPath = Array.from(svg?.querySelectorAll('path') ?? []).find((p) =>
      p.getAttribute('d')?.includes('h26 v16 h-26'),
    )
    expect(loopPath).toBeTruthy()
  })

  it('skips steps referencing unknown actors instead of crashing', () => {
    const block: Extract<Block, { type: 'seq' }> = {
      type: 'seq',
      actors: ['A', 'B'],
      steps: [
        { from: 'A', to: 'B', label: 'ok' },
        { from: 'A', to: 'Ghost', label: 'bad' },
      ],
    }
    expect(() => r(block)).not.toThrow()
    expect(screen.getByText('step 1/1')).toBeInTheDocument()
  })

  it('falls back to the "Sequence" caption when no title is given', () => {
    const untitled: Extract<Block, { type: 'seq' }> = { ...seqBlock }
    delete untitled.title
    r(untitled)
    expect(screen.getByText('Sequence')).toBeInTheDocument()
  })
})

describe('StateMachine block', () => {
  it('renders a node per state and marks the initial state as current', () => {
    r(stateBlock)
    expect(screen.getAllByText('Queued').length).toBeGreaterThan(0)
    expect(screen.getByText('queued')).toBeInTheDocument()
  })

  it('renders the diagram caption from block.title', () => {
    r(stateBlock)
    expect(screen.getByText('Request lifecycle')).toBeInTheDocument()
  })

  it('clicking a transition button moves current state and swaps the available events', () => {
    r(stateBlock)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    expect(screen.getByText('checking')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'pass' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'fail' })).toBeInTheDocument()
  })

  it('shows a reset button with no event buttons at a terminal state', () => {
    r(stateBlock)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    fireEvent.click(screen.getByRole('button', { name: 'fail' }))
    expect(screen.getByText('rejected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '↺ reset' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '↺ reset' }))
    expect(screen.getByText('queued')).toBeInTheDocument()
  })

  it('labels an unlabeled transition as "to {target}"', () => {
    const block: Extract<Block, { type: 'state' }> = {
      type: 'state',
      initial: 'a',
      states: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      transitions: [{ from: 'a', to: 'b' }],
    }
    r(block)
    expect(screen.getByRole('button', { name: 'to b' })).toBeInTheDocument()
  })

  it('skips transitions referencing unknown state ids instead of crashing', () => {
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
    expect(() => r(block)).not.toThrow()
    expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'bad' })).not.toBeInTheDocument()
  })

  it('falls back to the "State machine" caption when no title is given', () => {
    const untitled: Extract<Block, { type: 'state' }> = { ...stateBlock }
    delete untitled.title
    r(untitled)
    expect(screen.getByText('State machine')).toBeInTheDocument()
  })
})
