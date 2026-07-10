import type { Block } from '@brief/schema'
import type { CSSProperties } from 'react'

export function Stats({ block }: { block: Extract<Block, { type: 'stat' }> }) {
  const style = { '--stat-cols': `repeat(${Math.min(4, block.items.length)}, 1fr)` } as CSSProperties

  return (
    <div
      className="grid grid-cols-2 gap-3 my-4 min-[880px]:[grid-template-columns:var(--stat-cols)]"
      style={style}
    >
      {block.items.map((item, i) => (
        <div key={i} className="border border-line rounded-xl bg-card px-4 py-[15px] text-center">
          <p className="text-[28px] font-bold font-mono leading-none text-mauve">{item.value}</p>
          <p className="text-[12px] text-sub mt-1.5 leading-[1.4]">{item.label}</p>
          {item.hint && <p className="text-[11px] text-faint mt-1">{item.hint}</p>}
        </div>
      ))}
    </div>
  )
}
