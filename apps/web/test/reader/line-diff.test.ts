import { describe, expect, it } from 'vitest'
import { diffLines } from '@/features/reader/components/blocks/lineDiff'

describe('diffLines', () => {
  it('marks the removed and added lines of the B-Blocks before/after sample', () => {
    const before = ['export async function handle(req) {', '  return fetch(req.url)', '}']
    const after = [
      'export async function handle(req, env) {',
      '  const key = resolveKey(req)',
      '  return fetch(origin(req))',
      '}',
    ]
    expect(diffLines(before, after)).toEqual([
      { kind: 'del', before: 0 },
      { kind: 'del', before: 1 },
      { kind: 'add', after: 0 },
      { kind: 'add', after: 1 },
      { kind: 'add', after: 2 },
      { kind: 'same', before: 2, after: 3 },
    ])
  })

  it('keeps common lines in the middle of a change', () => {
    expect(diffLines(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'y', 'd'])).toEqual([
      { kind: 'same', before: 0, after: 0 },
      { kind: 'del', before: 1 },
      { kind: 'add', after: 1 },
      { kind: 'same', before: 2, after: 2 },
      { kind: 'add', after: 3 },
      { kind: 'same', before: 3, after: 4 },
    ])
  })

  it('handles identical, emptied and filled listings', () => {
    expect(diffLines(['a'], ['a'])).toEqual([{ kind: 'same', before: 0, after: 0 }])
    expect(diffLines(['a', 'b'], [])).toEqual([
      { kind: 'del', before: 0 },
      { kind: 'del', before: 1 },
    ])
    expect(diffLines([], ['a'])).toEqual([{ kind: 'add', after: 0 }])
  })
})
