import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Block } from '@brief/schema'

vi.mock('@/features/reader/services/shiki', () => ({
  highlightToHast: () => new Promise(() => {}),
}))

const HOSTILE = '<img src=x onerror="window.__xss=1">'

const r = (block: Block) =>
  render(
    <ReaderStateProvider sessionId="board-fields">
      <BlockRenderer block={block} sid={1} bid={0} />
    </ReaderStateProvider>,
  )

const header = () => document.querySelector('[data-kind-tag]')!.parentElement!

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
})
afterEach(() => vi.unstubAllGlobals())

describe('stat board fields (B-Blocks:41-47)', () => {
  it('shows the caption in the card header', () => {
    r({ type: 'stat', caption: 'Flash sale numbers', items: [{ label: 'Peak RPS', value: '4,800' }] })
    expect(header().textContent).toBe('statFlash sale numbers')
  })

  it('draws a spark as 8px bars scaled to a 20px row, the highest in text', () => {
    r({ type: 'stat', items: [{ label: 'Peak RPS', value: '4,800', spark: [6, 9, 7, 12, 20, 10] }] })
    const spark = screen.getByRole('img', { name: 'trend: 6, 9, 7, 12, 20, 10' })
    const bars = [...spark.children] as HTMLElement[]
    expect(bars.map((b) => b.style.height)).toEqual(['6px', '9px', '7px', '12px', '20px', '10px'])
    expect(bars.map((b) => b.className.includes('bg-text'))).toEqual([false, false, false, false, true, false])
    expect(bars.every((b) => b.className.includes('w-2'))).toBe(true)
  })

  it('draws an all-zero spark flat instead of at NaN height', () => {
    r({ type: 'stat', items: [{ label: 'errors', value: '0', spark: [0, 0] }] })
    const bars = [...screen.getByRole('img', { name: 'trend: 0, 0' }).children] as HTMLElement[]
    expect(bars.map((b) => b.style.height)).toEqual(['0px', '0px'])
  })

  it('colors a hint by hintTone, and leaves a hint without one faint', () => {
    r({
      type: 'stat',
      items: [
        { label: 'p95', value: '2.4 s', tone: 'red', hint: '8x over target', hintTone: 'red' },
        { label: '5xx', value: '11%', tone: 'red', hint: 'during the burst' },
      ],
    })
    expect(screen.getByText('8x over target').className).toContain('text-data-red')
    expect(screen.getByText('during the burst').className).toContain('text-faint')
    expect(screen.getByText('during the burst').className).not.toContain('text-data-red')
  })

  it('renders without a caption or spark exactly as before', () => {
    r({ type: 'stat', items: [{ label: 'files', value: '12', hint: 'h' }] })
    expect(header().textContent).toBe('stat')
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('table board fields (B-Blocks:113-122)', () => {
  const block: Extract<Block, { type: 'table' }> = {
    type: 'table',
    head: ['Option', 'Accuracy', 'Latency', 'Cost'],
    rows: [
      ['Rate limiting binding', '5%', '<1 ms', 'in plan'],
      ['Durable Object', 'exact', '10-40 ms', 'per request'],
    ],
    align: ['left', 'center', 'right'],
    cells: [
      { row: 1, col: 3, tone: 'good' },
      { row: 2, col: 3, tone: 'warn' },
      { row: 9, col: 9, tone: 'bad' },
    ],
  }

  it('aligns each column, header included, and leaves a column with no entry left', () => {
    r(block)
    const align = (text: string) =>
      ['text-left', 'text-center', 'text-right'].filter((c) =>
        screen.getByText(text).closest('th,td')!.className.split(' ').includes(c),
      )
    expect(['Option', 'Accuracy', 'Latency', 'Cost'].map(align)).toEqual([
      ['text-left'],
      ['text-center'],
      ['text-right'],
      ['text-left'],
    ])
    expect(['Rate limiting binding', '5%', '<1 ms', 'in plan'].map(align)).toEqual([
      ['text-left'],
      ['text-center'],
      ['text-right'],
      ['text-left'],
    ])
  })

  it('colors a toned cell with its tone and ignores a cell outside the table', () => {
    r(block)
    const cell = (text: string) => screen.getByText(text).closest('th,td')!.className
    expect(cell('<1 ms')).toContain('text-good')
    expect(cell('10-40 ms')).toContain('text-warn')
    expect(cell('<1 ms')).not.toContain('text-text')
    expect(cell('5%')).toContain('text-text')
    expect(document.querySelector('.text-bad')).toBeNull()
  })

  it('renders without align or cells exactly as before', () => {
    r({ type: 'table', head: ['a', 'b'], rows: [['1', '2']] })
    const classes = (el: Element) => el.className.split(' ').sort()
    expect(classes(screen.getByText('b').closest('th')!)).toEqual(['font-medium', 'px-3', 'py-2', 'text-left'])
    expect(classes(screen.getByText('2').closest('td')!)).toEqual(['px-3', 'py-[9px]', 'text-left', 'text-text'])
  })
})

describe('ba board fields (B-Blocks:142)', () => {
  it('shows the filename then "before and after" in the card header', () => {
    r({ type: 'ba', language: 'ts', filename: 'src/limiter.ts', before: 'a', after: 'b' })
    expect(header().textContent).toBe('basrc/limiter.ts / before and afterSplitUnified')
  })

  it('renders without a filename exactly as before', () => {
    r({ type: 'ba', language: 'ts', before: 'a', after: 'b' })
    expect(header().textContent).toBe('baSplitUnified')
  })
})

describe('round 1 board fields render payload text as text', () => {
  it('a hostile stat caption, hint, table cell and ba filename make no element', () => {
    r({
      type: 'stat',
      caption: HOSTILE,
      items: [{ label: 'l', value: 'v', hint: HOSTILE, hintTone: 'red', spark: [1, 2] }],
    })
    r({ type: 'table', head: ['a'], rows: [[HOSTILE]], align: ['right'], cells: [{ row: 1, col: 1, tone: 'bad' }] })
    r({ type: 'ba', language: 'ts', filename: HOSTILE, before: 'a', after: 'b' })
    expect(screen.getAllByText(HOSTILE, { exact: false })).toHaveLength(4)
    expect(document.querySelector('img')).toBeNull()
    expect((window as { __xss?: number }).__xss).toBeUndefined()
  })
})
