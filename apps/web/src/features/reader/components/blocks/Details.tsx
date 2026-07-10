import type { Block } from '@brief/schema'
import { BlockRenderer } from '../BlockRenderer'

export function Details({ block }: { block: Extract<Block, { type: 'details' }> }) {
  return (
    <details className="group border border-line rounded-[10px] bg-elev my-3.5 overflow-hidden">
      <summary className="w-full flex items-center gap-[9px] text-[13.5px] font-semibold px-[15px] py-[11px] text-left cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="text-mauve transition-transform duration-[180ms] group-open:rotate-90 inline-block"
        >
          ▸
        </span>
        <span>{block.summary}</span>
      </summary>
      <div className="pl-[35px] pr-[15px] pb-[13px] text-[13.5px] leading-[1.75] text-sub">
        {/* Details-nested content is not annotatable (controller adjudication):
            nested paragraphs have no stable top-level block index, so a
            defaulted sid/bid would alias section 0's first paragraph. */}
        {block.blocks.map((b, i) => (
          <BlockRenderer key={i} block={b} annotatable={false} />
        ))}
      </div>
    </details>
  )
}
