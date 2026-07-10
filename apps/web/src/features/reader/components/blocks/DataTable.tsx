import type { Block } from '@brief/schema'

export function DataTable({ block }: { block: Extract<Block, { type: 'table' }> }) {
  return (
    <figure className="my-4 border border-line rounded-xl bg-card overflow-hidden">
      <figcaption className="px-3.5 py-[9px] border-b border-line2 bg-elev font-mono text-[10.5px] tracking-[.04em] text-faint">
        {block.caption ?? 'Table'}
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
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className={i % 2 === 1 ? 'bg-[var(--row-zebra)]' : undefined}>
                {row.map((cell, j) =>
                  j === 0 ? (
                    <th
                      key={j}
                      scope="row"
                      className="px-3.5 py-[9px] border-b border-line2 text-left font-semibold text-text whitespace-nowrap"
                    >
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className="px-3.5 py-[9px] border-b border-line2 text-left text-sub">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
