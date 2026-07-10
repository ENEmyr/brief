import type { Block } from '@brief/schema'
import { CodePre } from './CodePre'

type CodeBlockType = Extract<Block, { type: 'code' }>

/**
 * Code-specific figure per the task-5 brief: same header-bar chrome as
 * DiagramCard (caption mono 10.5 faint on elev bg) but no Expand button —
 * code blocks aren't diagrams to zoom/pan, so this is a bespoke figure
 * rather than a reuse of DiagramCard.
 */
export function CodeBlock({ block }: { block: CodeBlockType }) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line2 bg-elev px-3.5 py-[9px]">
        <span className="font-mono text-[10.5px] tracking-[.04em] text-faint">{block.filename ?? block.language}</span>
      </div>
      <CodePre code={block.code} language={block.language} highlightLines={block.highlight} />
    </div>
  )
}
