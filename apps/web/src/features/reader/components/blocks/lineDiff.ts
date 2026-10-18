/** One row of a line diff. `before` and `after` are 0-based line indexes. */
export type DiffRow =
  | { kind: 'same'; before: number; after: number }
  | { kind: 'del'; before: number }
  | { kind: 'add'; after: number }

// Above this many cells the middle of a diff is shown as a plain replace
// rather than paying for the table.
const MAX_CELLS = 1_000_000

/**
 * Longest-common-subsequence diff of two line lists, in unified order: within
 * a change, removed lines come before the lines that replace them. The common
 * head and tail are matched first, so the table only covers what changed.
 */
export function diffLines(before: readonly string[], after: readonly string[]): DiffRow[] {
  let head = 0
  while (head < before.length && head < after.length && before[head] === after[head]) head++
  let tail = 0
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail++
  }

  const rows: DiffRow[] = []
  for (let i = 0; i < head; i++) rows.push({ kind: 'same', before: i, after: i })
  for (const row of diffMiddle(before, after, head, before.length - tail, after.length - tail)) {
    rows.push(row)
  }
  for (let k = tail; k > 0; k--) {
    rows.push({ kind: 'same', before: before.length - k, after: after.length - k })
  }
  return rows
}

function diffMiddle(
  a: readonly string[],
  b: readonly string[],
  from: number,
  aEnd: number,
  bEnd: number,
): DiffRow[] {
  const n = aEnd - from
  const m = bEnd - from
  const replace = (): DiffRow[] => [
    ...Array.from({ length: n }, (_, i): DiffRow => ({ kind: 'del', before: from + i })),
    ...Array.from({ length: m }, (_, j): DiffRow => ({ kind: 'add', after: from + j })),
  ]
  if (n === 0 || m === 0 || (n + 1) * (m + 1) > MAX_CELLS) return replace()

  // lcs[i * (m + 1) + j]: common lines between a[from + i..] and b[from + j..].
  const lcs = new Uint32Array((n + 1) * (m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * (m + 1) + j] =
        a[from + i] === b[from + j]
          ? lcs[(i + 1) * (m + 1) + j + 1]! + 1
          : Math.max(lcs[(i + 1) * (m + 1) + j]!, lcs[i * (m + 1) + j + 1]!)
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[from + i] === b[from + j]) {
      rows.push({ kind: 'same', before: from + i, after: from + j })
      i++
      j++
    } else if (j === m || (i < n && lcs[(i + 1) * (m + 1) + j]! >= lcs[i * (m + 1) + j + 1]!)) {
      rows.push({ kind: 'del', before: from + i })
      i++
    } else {
      rows.push({ kind: 'add', after: from + j })
      j++
    }
  }
  return rows
}
