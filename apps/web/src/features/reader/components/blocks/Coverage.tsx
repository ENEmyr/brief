import type { Block } from '@brief/schema'

const barFill = {
  full: 'bg-green w-full',
  partial: 'bg-peach w-1/2',
  missing: 'bg-red w-[8%]',
} as const

const legend = [
  { status: 'full', color: 'bg-green' },
  { status: 'partial', color: 'bg-peach' },
  { status: 'missing', color: 'bg-red' },
] as const

export function Coverage({ block }: { block: Extract<Block, { type: 'coverage' }> }) {
  return (
    <figure className="my-4">
      <figcaption className="font-mono text-[10.5px] tracking-[.04em] text-faint mb-2.5">Coverage</figcaption>
      {block.items.map((item, i) => (
        <div
          key={i}
          className="grid grid-cols-1 min-[880px]:grid-cols-[190px_1fr_128px] items-center gap-2.5 mb-2 text-[12.5px]"
        >
          <span className="font-semibold text-text">{item.label}</span>
          <div
            role="img"
            aria-label={`${item.label}: ${item.status}`}
            className="flex h-4 rounded-md overflow-hidden bg-chip"
          >
            <div className={`h-full ${barFill[item.status]}`} />
          </div>
          <span className="hidden min-[880px]:block font-mono text-[11px] text-sub text-right whitespace-nowrap">
            {item.note ?? ''}
          </span>
        </div>
      ))}
      <div className="flex gap-3.5 mt-2 text-[11px] text-faint">
        {legend.map((l) => (
          <span key={l.status} className="flex items-center gap-1">
            <span className={`inline-block w-[9px] h-[9px] rounded-sm ${l.color}`} />
            {l.status}
          </span>
        ))}
      </div>
    </figure>
  )
}
