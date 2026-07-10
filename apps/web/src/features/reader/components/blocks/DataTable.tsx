import type { Block } from '@brief/schema'

export function DataTable({ block }: { block: Extract<Block, { type: 'table' }> }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">
        {block.caption && <caption className="my-2 text-left text-subtext1">{block.caption}</caption>}
        <thead>
          <tr className="border-b border-surface1">
            {block.head.map((cell, i) => (
              <th key={i} className="px-4 py-2 text-left font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className="border-b border-surface1 odd:bg-surface0/40">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
