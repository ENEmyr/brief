import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'

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
    <figure className="my-4 border border-line rounded-xl bg-card overflow-hidden">
      <figcaption className="px-3.5 py-[9px] border-b border-line2 bg-elev font-mono text-[10.5px] tracking-[.04em] text-faint">
        {block.caption ? (
          <Annotatable {...anchor} text={block.caption} path={`${pathPrefix}caption`} />
        ) : (
          'Table'
        )}
      </figcaption>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {block.head.map((cell, i) => (
                <th
                  key={i}
                  className={`text-left px-3.5 py-2.5 font-semibold border-b-2 border-mauvesoft bg-elev whitespace-nowrap ${
                    i === 0 ? 'text-faint text-[11.5px] uppercase' : 'text-mauve text-[13px]'
                  }`}
                >
                  <Annotatable {...anchor} text={cell} path={`${pathPrefix}head.${i}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className={i % 2 === 1 ? 'bg-[var(--row-zebra)]' : undefined}>
                {row.map((cell, j) => {
                  const content = (
                    <Annotatable {...anchor} text={cell} path={`${pathPrefix}rows.${i}.${j}`} />
                  )
                  return j === 0 ? (
                    <th
                      key={j}
                      scope="row"
                      className="px-3.5 py-[9px] border-b border-line2 text-left font-semibold text-text whitespace-nowrap"
                    >
                      {content}
                    </th>
                  ) : (
                    <td key={j} className="px-3.5 py-[9px] border-b border-line2 text-left text-sub">
                      {content}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
