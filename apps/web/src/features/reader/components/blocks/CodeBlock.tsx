import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
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
 * payload — `filename` when the block has one, otherwise the `language` label —
 * so the anchor names whichever leaf is actually on screen. It wraps rather
 * than truncating, so a <mark> in a long path stays visible.
 */
export function CodeBlock({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: { block: CodeBlockType } & BlockAnchor) {
  const leaf = block.filename === undefined ? 'language' : 'filename'

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line2 bg-elev px-3.5 py-[9px]">
        <Annotatable
          className="min-w-0 break-words font-mono text-[10.5px] tracking-[.04em] text-faint"
          text={block.filename ?? block.language}
          sid={sid}
          bid={bid ?? null}
          path={`${pathPrefix}${leaf}`}
          annotatable={annotatable && bid !== undefined}
          onMarkClick={onMarkClick}
        />
      </div>
      <CodePre code={block.code} language={block.language} highlightLines={block.highlight} />
    </div>
  )
}
