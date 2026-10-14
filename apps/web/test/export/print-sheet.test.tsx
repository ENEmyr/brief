import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import type { Payload } from '@brief/schema'
import type { Highlight, ReaderState } from '@/features/reader-state'
import { ReaderStateProvider } from '@/features/reader-state'
import { ExportProvider } from '@/features/export'
import { insertPrintNotes, printedLine, sessionLine } from '@/features/export/lib/printSheet'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.clear()
})

const payload: Payload = {
  meta: { title: 'Rate limit for the public API', subtitle: 'Four calls need you.' },
  sections: [
    { id: 's1', no: 1, title: 'Overview', blocks: [{ type: 'p', text: 'Hello world' }] },
    { id: 's2', no: 2, title: 'Options', blocks: [{ type: 'p', text: 'Two ways' }] },
  ],
  decisions: [
    { id: 'D1', q: 'Where does the limiter sit?', multi: false, opts: [{ id: 'edge', label: 'Edge Worker' }] },
    { id: 'D2', q: 'How many per minute?', multi: false, opts: [{ id: '60', label: '60 / min' }] },
    {
      id: 'D3',
      q: 'What is the key?',
      multi: true,
      opts: [
        { id: 'api', label: 'API key' },
        { id: 'ip', label: 'IP' },
        { id: 'user', label: 'User ID' },
      ],
    },
    { id: 'D4', q: 'Which headers go back?', multi: false, opts: [{ id: 'std', label: 'RateLimit-*' }] },
  ],
}

const state: ReaderState = {
  highlights: [],
  dsel: { D1: ['edge'], D3: ['api', 'user'] },
  dnote: { D1: 'close to users', D2: 'free tier stays under 120' },
  dother: { D2: '300 / min for the free tier' },
}

const highlight = (id: string, note: string | null): Highlight => ({
  id,
  sid: 0,
  bid: 0,
  start: 6,
  end: 11,
  text: 'world',
  note,
})

describe('print lines', () => {
  it('writes the session line the way B-Print does', () => {
    expect(sessionLine('k2p9x4Qm7Zr1Ta', payload, state)).toBe(
      'session k2p9x4Qm7Zr1Ta / 2 sections / 4 decisions, 3 answered',
    )
  })

  it('uses the singular for one and leaves out decisions when there are none', () => {
    const one = { ...payload, sections: payload.sections.slice(0, 1), decisions: payload.decisions.slice(0, 1) }
    expect(sessionLine('abc', one, state)).toBe('session abc / 1 section / 1 decision, 1 answered')
    expect(sessionLine('abc', { ...payload, decisions: [] }, state)).toBe('session abc / 2 sections')
  })

  it('stamps the print time in UTC', () => {
    expect(printedLine(new Date(Date.UTC(2026, 9, 14, 9, 30, 59)), 'brief.algoryth.me/s/k2p9x4Qm7Zr1Ta')).toBe(
      'printed 2026-10-14 09:30 UTC from brief.algoryth.me/s/k2p9x4Qm7Zr1Ta',
    )
  })
})

describe('insertPrintNotes', () => {
  function page(html: string) {
    document.body.innerHTML = html
    return document.body
  }

  it('writes the note after the highlighted text, as text, and takes it out again', () => {
    const root = page('<p data-sid="0" data-bid="0">Hello <mark data-mark-id="h1">world</mark> again</p>')
    const remove = insertPrintNotes(root, [highlight('h1', '<b>staging</b> or prod?')])

    const p = root.querySelector('p')!
    const note = p.lastElementChild!
    expect(note).toHaveAttribute('data-print-note')
    expect(note.textContent).toBe('Note: <b>staging</b> or prod?')
    expect(note.querySelector('b')!.textContent).toBe('Note:')
    expect(note.querySelectorAll('b')).toHaveLength(1)

    remove()
    expect(root.querySelector('[data-print-note]')).toBeNull()
    expect(p.textContent).toBe('Hello world again')
  })

  it('skips highlights without a note and does not add a note twice', () => {
    const root = page(
      '<p data-sid="0" data-bid="0"><mark data-mark-id="a">one</mark> <mark data-mark-id="b">two</mark></p>',
    )
    insertPrintNotes(root, [highlight('a', null), highlight('b', '  ')])
    expect(root.querySelector('[data-print-note]')).toBeNull()

    insertPrintNotes(root, [highlight('a', 'first')])
    insertPrintNotes(root, [highlight('a', 'first')])
    expect([...root.querySelectorAll('[data-print-note]')].map((n) => n.textContent)).toEqual(['Note: first'])
  })

  it('puts a note on code after the listing', () => {
    const root = page(
      '<div><pre><code><span data-sid="1" data-bid="2"><mark data-mark-id="c">b.tokens -= 1</mark></span></code></pre></div>',
    )
    insertPrintNotes(root, [highlight('c', 'race?')])
    expect(root.querySelector('pre')!.nextElementSibling!.textContent).toBe('Note: race?')
  })
})

describe('ExportProvider while printing', () => {
  function renderReader(highlights: Highlight[] = []) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    localStorage.setItem('idocs:k2p9x4Qm7Zr1Ta', JSON.stringify({ ...state, highlights }))
    return render(
      <ReaderStateProvider sessionId="k2p9x4Qm7Zr1Ta">
        <ExportProvider sessionId="k2p9x4Qm7Zr1Ta" payload={payload}>
          <p data-sid="0" data-bid="0">
            Hello <mark data-mark-id="h1">world</mark>
          </p>
        </ExportProvider>
      </ReaderStateProvider>,
    )
  }

  it('renders nothing extra until the browser prints', () => {
    renderReader()
    expect(screen.queryByRole('heading', { name: 'Your answers' })).toBeNull()
    expect(screen.queryByText(/^printed /)).toBeNull()
  })

  it('adds the title block, the answers table and the notes for one print', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 14, 9, 30)))
    renderReader([highlight('h1', 'is this prod?')])

    act(() => {
      window.dispatchEvent(new Event('beforeprint'))
    })

    expect(screen.getByRole('heading', { level: 1, name: payload.meta.title })).toBeInTheDocument()
    expect(screen.getByText('session k2p9x4Qm7Zr1Ta / 2 sections / 4 decisions, 3 answered')).toBeInTheDocument()
    expect(
      screen.getByText(`printed 2026-10-14 09:30 UTC from ${window.location.host}/s/k2p9x4Qm7Zr1Ta`),
    ).toBeInTheDocument()
    expect(screen.getByText('Four calls need you.')).toBeInTheDocument()

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'id',
      'question',
      'answer',
      'note',
    ])
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))
    expect(rows).toEqual([
      ['D1', 'Where does the limiter sit?', 'Edge Worker', 'close to users'],
      ['D2', 'How many per minute?', 'Other: 300 / min for the free tier', 'free tier stays under 120'],
      ['D3', 'What is the key?', 'API key; User ID', ''],
      ['D4', 'Which headers go back?', '(not answered)', ''],
    ])
    expect(within(table).getByText('Other:').tagName).toBe('I')
    expect(within(table).getByText('(not answered)').tagName).toBe('B')
    expect(document.querySelector('[data-print-note]')!.textContent).toBe('Note: is this prod?')

    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(document.querySelector('[data-print-note]')).toBeNull()
  })
})
