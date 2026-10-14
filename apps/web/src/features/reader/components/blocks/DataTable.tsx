import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'

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
                <th key={i} className="px-3 py-2 text-left font-medium">
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
                      className="px-3 py-[9px] text-left font-normal text-text"
                    >
                      {content}
                    </th>
                  ) : (
                    <td key={j} className="px-3 py-[9px] text-left text-text">
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
