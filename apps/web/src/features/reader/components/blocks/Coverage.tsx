import type { Block } from '@brief/schema'

const statusStyles = {
  full: 'bg-green/15 text-green',
  partial: 'bg-yellow/15 text-yellow',
  missing: 'bg-red/15 text-red',
} as const

export function Coverage({ block }: { block: Extract<Block, { type: 'coverage' }> }) {
  return (
    <div className="my-4 space-y-3">
      {block.items.map((item, i) => (
        <div key={i} className="flex items-center justify-between">
          <span className="text-text">{item.label}</span>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyles[item.status]}`}>
              {item.status}
            </span>
            {item.note && <span className="text-xs text-subtext1">{item.note}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
