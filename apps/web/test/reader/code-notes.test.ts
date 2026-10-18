import { describe, expect, it } from 'vitest'
import { notesByLine, placeNotes } from '@/features/reader/components/blocks/codeNotes'

describe('placeNotes', () => {
  it('places each note on its last line with a range label and letters in listing order', () => {
    const placed = placeNotes(
      [
        { from: 3, to: 4, text: 'second' },
        { from: 2, text: 'first' },
      ],
      { code: 6 },
    )
    expect(placed).toEqual([
      { key: 'code.1', letter: 'A', range: 'L2', text: 'first', side: 'code', line: 1 },
      { key: 'code.0', letter: 'B', range: 'L3-4', text: 'second', side: 'code', line: 3 },
    ])
  })

  it('ignores a note past the last line and one whose range runs backwards', () => {
    const placed = placeNotes(
      [
        { from: 7, text: 'past the end' },
        { from: 5, to: 7, text: 'ends past the end' },
        { from: 4, to: 2, text: 'backwards' },
        { from: 6, text: 'last line' },
      ],
      { code: 6 },
    )
    expect(placed.map((n) => n.text)).toEqual(['last line'])
  })

  it('puts before/after notes on their own side, before notes first', () => {
    const placed = placeNotes(
      [
        { side: 'after', from: 1, text: 'env carries the binding' },
        { side: 'before', from: 2, text: 'old path' },
        { side: 'before', from: 3, text: 'only two lines before' },
      ],
      { before: 2, after: 4 },
    )
    expect(placed.map((n) => [n.letter, n.side, n.line, n.text])).toEqual([
      ['A', 'before', 1, 'old path'],
      ['B', 'after', 0, 'env carries the binding'],
    ])
  })

  it('letters past Z continue as AA, AB', () => {
    const notes = Array.from({ length: 28 }, (_, i) => ({ from: i + 1, text: `n${i}` }))
    expect(placeNotes(notes, { code: 28 }).slice(25).map((n) => n.letter)).toEqual(['Z', 'AA', 'AB'])
  })

  it('returns nothing for a block without notes', () => {
    expect(placeNotes(undefined, { code: 3 })).toEqual([])
  })
})

describe('notesByLine', () => {
  it('groups notes ending on the same line under one row key', () => {
    const placed = placeNotes(
      [
        { from: 1, to: 2, text: 'a' },
        { from: 2, text: 'b' },
      ],
      { code: 2 },
    )
    expect(notesByLine(placed).get('code.1')?.map((n) => n.text)).toEqual(['a', 'b'])
  })
})
