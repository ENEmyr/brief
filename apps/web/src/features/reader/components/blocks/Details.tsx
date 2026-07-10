import type { Block } from '@brief/schema'
import { BlockRenderer } from '../BlockRenderer'

export function Details({ block }: { block: Extract<Block, { type: 'details' }> }) {
  return (
    <details className="my-4 rounded-lg border border-surface1 p-4">
      <summary className="cursor-pointer font-medium">{block.summary}</summary>
      <div className="mt-4 space-y-2">
        {block.blocks.map((b, i) => (
          <BlockRenderer key={i} block={b} />
        ))}
      </div>
    </details>
  )
}
