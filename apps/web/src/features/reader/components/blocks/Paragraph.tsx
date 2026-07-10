import type { Block } from '@brief/schema'

export function Paragraph({ block }: { block: Extract<Block, { type: 'p' }> }) {
  return (
    <p data-block="p" className="my-4 leading-relaxed text-text">
      {block.text}
    </p>
  )
}
