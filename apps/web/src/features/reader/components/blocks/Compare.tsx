import type { Block } from '@brief/schema'

export function Compare({ block }: { block: Extract<Block, { type: 'compare' }> }) {
  return (
    <div className="my-4 grid gap-4 md:grid-cols-2">
      {[
        { side: 'left', data: block.left },
        { side: 'right', data: block.right },
      ].map(({ side, data }) => (
        <div key={side} className="rounded-lg border border-surface1 p-4">
          <h3 className="mb-3 font-semibold">{data.title}</h3>
          <ul className="space-y-2">
            {data.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={item.ok ? 'text-green' : 'text-red'}>
                  {item.ok ? '+' : '-'}
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
