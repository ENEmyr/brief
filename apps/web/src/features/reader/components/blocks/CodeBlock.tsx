import type { Block } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { CodePre } from './CodePre'

type CodeBlockType = Extract<Block, { type: 'code' }>

export function CodeBlock({
  block,
  pathPrefix = '',
  ...anchor
}: { block: CodeBlockType } & BlockAnchor) {
  return (
    <BlockCard {...cardHeader(block, { ...anchor, pathPrefix })}>
      <CodePre
        code={block.code}
        language={block.language}
        highlightLines={block.highlight}
        notes={block.notes}
        pathPrefix={pathPrefix}
        {...anchor}
      />
    </BlockCard>
  )
}
