import type { Block } from '@brief/schema'
import { HighlightedText } from '@/features/annotations'

export function Paragraph({
  block,
  sid,
  bid,
}: {
  block: Extract<Block, { type: 'p' }>
  sid: number
  bid: number
}) {
  return (
    <p data-block="p" data-hl data-sid={sid} data-bid={bid} className="text-[15px] leading-[1.85] text-text mb-3.5">
      <HighlightedText sid={sid} bid={bid} text={block.text} />
    </p>
  )
}
