import type { Block } from '@brief/schema'
import { Paragraph } from './blocks/Paragraph'
import { Callout } from './blocks/Callout'
import { DataTable } from './blocks/DataTable'
import { Compare } from './blocks/Compare'
import { Stats } from './blocks/Stats'
import { Coverage } from './blocks/Coverage'
import { Details } from './blocks/Details'
import { UnknownBlock } from './blocks/UnknownBlock'
import { WidgetPlaceholder } from './blocks/WidgetPlaceholder'
import { Seq } from './blocks/Seq'
import { StateMachine } from './blocks/StateMachine'

// The remaining diagram/chart block types that don't have a real component
// yet (Plan 3 tasks 4-8 swap each of these in as a one-line case above the
// default). Checked at runtime, not just inferred from the type union,
// since arbitrary/legacy payloads can still reach the default branch.
const WIDGET_TYPES = new Set<Block['type']>([
  'layers', 'ba', 'erd', 'bigo', 'code', 'mermaid', 'math',
  'heatmap', 'histogram', 'scatter', 'plot3d',
])

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'p':
      return <Paragraph block={block} />
    case 'note':
    case 'warn':
    case 'good':
      return <Callout block={block} />
    case 'table':
      return <DataTable block={block} />
    case 'compare':
      return <Compare block={block} />
    case 'stat':
      return <Stats block={block} />
    case 'coverage':
      return <Coverage block={block} />
    case 'details':
      return <Details block={block} />
    case 'seq':
      return <Seq block={block} />
    case 'state':
      return <StateMachine block={block} />
    default:
      return WIDGET_TYPES.has(block.type) ? <WidgetPlaceholder block={block} /> : <UnknownBlock block={block} />
  }
}
