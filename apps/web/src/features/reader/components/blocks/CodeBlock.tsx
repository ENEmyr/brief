import { useMemo } from 'react'
import type { Block } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { placeNotes } from './codeNotes'
import { CodePre, WithPrintedNotes } from './CodePre'

type CodeBlockType = Extract<Block, { type: 'code' }>

export function CodeBlock({
  block,
  pathPrefix = '',
  ...anchor
}: { block: CodeBlockType } & BlockAnchor) {
  const lineCount = block.code.split('\n').length
  const placed = useMemo(
    () => placeNotes(block.notes, { code: lineCount }),
    [block.notes, lineCount],
  )
  return (
    <WithPrintedNotes notes={placed}>
      <BlockCard {...cardHeader(block, { ...anchor, pathPrefix })}>
        <CodePre
          code={block.code}
          language={block.language}
          highlightLines={block.highlight}
          placed={placed}
          pathPrefix={pathPrefix}
          {...anchor}
        />
      </BlockCard>
    </WithPrintedNotes>
  )
}
