import type { Block } from '@brief/schema'

export function Paragraph({ block }: { block: Extract<Block, { type: 'p' }> }) {
  return (
    <p data-block="p" className="text-[15px] leading-[1.85] text-text mb-3.5">
      {block.text}
    </p>
  )
}
