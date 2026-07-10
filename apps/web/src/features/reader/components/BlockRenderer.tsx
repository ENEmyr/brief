import type { Block } from '@brief/schema'
import { Paragraph } from './blocks/Paragraph'
import { Callout } from './blocks/Callout'
import { DataTable } from './blocks/DataTable'
import { Compare } from './blocks/Compare'
import { Stats } from './blocks/Stats'
import { Coverage } from './blocks/Coverage'
import { Details } from './blocks/Details'
import { UnknownBlock } from './blocks/UnknownBlock'

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
    default:
      return <UnknownBlock block={block} />
  }
}
