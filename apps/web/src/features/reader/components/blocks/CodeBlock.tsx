import type { Block } from '@brief/schema'
import { CardCaption } from '../CardCaption'
import type { BlockAnchor } from '../blockAnchor'
import { CodePre } from './CodePre'

type CodeBlockType = Extract<Block, { type: 'code' }>

/**
 * Code-specific figure per the task-5 brief: same header-bar chrome as
 * DiagramCard (caption mono 10.5 faint on elev bg) but no Expand button —
 * code blocks aren't diagrams to zoom/pan, so this is a bespoke figure
 * rather than a reuse of DiagramCard.
 *
 * The header is an annotatable leaf. Both strings it can show come from the
 * payload, `filename` when the block has one and otherwise the `language`
 * label, so the anchor names whichever leaf is actually on screen. There is no
 * chrome case here, unlike a diagram's fallback caption: either way the header
 * is real payload text.
 */
export function CodeBlock({
  block,
  pathPrefix = '',
  ...anchor
}: { block: CodeBlockType } & BlockAnchor) {
  const leaf = block.filename === undefined ? 'language' : 'filename'

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line2 bg-elev px-3.5 py-[9px]">
        <CardCaption
          {...anchor}
          text={block.filename ?? block.language}
          path={`${pathPrefix}${leaf}`}
        />
      </div>
      <CodePre
        code={block.code}
        language={block.language}
        highlightLines={block.highlight}
        pathPrefix={pathPrefix}
        field="code"
        {...anchor}
      />
    </div>
  )
}
