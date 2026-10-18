import type { Align, Block, Tone } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'

// B-Blocks:117-120: a column's alignment applies to its header cell too. A
// column with no entry is left, the default /raw writes as `---`.
const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const satisfies Record<Align, string>
const toneClass = { info: 'text-info', good: 'text-good', warn: 'text-warn', bad: 'text-bad' } as const satisfies Record<Tone, string>

// B-Blocks:114-122: value cells (every column after the first) are Geist Mono.
// A Thai cell stays in the sans face because Geist Mono has no Thai glyphs.
const hasThai = /\p{Script=Thai}/u

/**
 * Every cell is its own annotatable leaf (`head.2`, `rows.1.0`), which is the
 * only way a table can be annotated at all: it has no single flat text field to
 * count character offsets into, but each cell does.
 */
export function DataTable({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: {
  block: Extract<Block, { type: 'table' }>
  sid?: number
  bid?: number
  pathPrefix?: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}) {
  const anchor = {
    sid,
    bid: bid ?? null,
    annotatable: annotatable && bid !== undefined,
    onMarkClick,
  }
  const align = (col: number) => alignClass[block.align?.[col] ?? 'left']
  // `cells` positions are 1-based; one outside the table is never looked up.
  const tones = new Map(block.cells?.map((c) => [`${c.row - 1}:${c.col - 1}`, c.tone]))
  const tone = (row: number, col: number) => {
    const t = tones.get(`${row}:${col}`)
    return t ? toneClass[t] : 'text-text'
  }

  return (
    <BlockCard
      {...cardHeader(block, { sid, bid, pathPrefix, annotatable, onMarkClick })}
      meta={
        <span className="shrink-0">
          {block.rows.length === 1 ? '1 row' : `${block.rows.length} rows`}
        </span>
      }
    >
      {/* B-Blocks:114-122: an elev header row in sub, then rows on a line rule
          with every second one on the zebra fill. The first column stays a row
          header for screen readers but looks like any other cell. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] leading-5">
          <thead>
            <tr className="bg-elev text-left text-sub">
              {block.head.map((cell, i) => (
                <th key={i} className={`px-3 py-2 font-medium ${align(i)}`}>
                  <Annotatable {...anchor} text={cell} path={`${pathPrefix}head.${i}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr
                key={i}
                className={`border-t border-line ${i % 2 === 1 ? 'bg-[var(--c-table-zebra)]' : ''}`}
              >
                {row.map((cell, j) => {
                  const content = (
                    <Annotatable {...anchor} text={cell} path={`${pathPrefix}rows.${i}.${j}`} />
                  )
                  return j === 0 ? (
                    <th
                      key={j}
                      scope="row"
                      className={`px-3 py-[9px] font-normal ${align(j)} ${tone(i, j)}`}
                    >
                      {content}
                    </th>
                  ) : (
                    <td
                      key={j}
                      className={`px-3 py-[9px] ${hasThai.test(cell) ? '' : 'font-mono'} ${align(j)} ${tone(i, j)}`}
                    >
                      {content}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockCard>
  )
}
