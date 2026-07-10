import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'

function widgetCaption(block: Block): string {
  if ('title' in block && block.title) return block.title
  return block.type
}

/**
 * Temporary stand-in for the 1 remaining widget block type (plot3d) until
 * its real component lands in a later Plan 3 task. Wraps the same JSON
 * fallback UnknownBlock renders, inside DiagramCard's chrome, so swapping in
 * a real component later is a one-line change in BlockRenderer.
 */
export function WidgetPlaceholder({ block }: { block: Block }) {
  return (
    <DiagramCard caption={widgetCaption(block)} expandable={false}>
      <pre className="overflow-x-auto text-xs text-sub font-mono">{JSON.stringify(block, null, 2)}</pre>
    </DiagramCard>
  )
}
