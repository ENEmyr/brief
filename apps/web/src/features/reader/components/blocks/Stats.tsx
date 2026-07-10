import type { Block } from '@brief/schema'

export function Stats({ block }: { block: Extract<Block, { type: 'stat' }> }) {
  return (
    <div className="my-4 grid grid-cols-2 gap-4 md:grid-cols-4">
      {block.items.map((item, i) => (
        <div key={i} className="rounded-lg bg-mantle p-4">
          <p className="mb-2 text-sm text-subtext1">{item.label}</p>
          <p className="mb-1 text-2xl font-bold text-text">{item.value}</p>
          {item.hint && <p className="text-xs text-subtext0">{item.hint}</p>}
        </div>
      ))}
    </div>
  )
}
