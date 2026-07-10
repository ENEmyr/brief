'use client'
import { useState } from 'react'
import type { Block } from '@brief/schema'
import { CodePre } from './CodePre'

type BeforeAfterBlock = Extract<Block, { type: 'ba' }>

function segmentClass(active: boolean): string {
  const base = 'rounded-md px-3 py-1 text-[12px] font-semibold max-[879px]:min-h-11'
  return active ? `${base} bg-mauve text-white` : `${base} bg-transparent text-sub`
}

/**
 * Before/after code panel (Reader.dc.html 695-705): DiagramCard-style header
 * with a segmented Before/After control instead of an Expand button, body =
 * shiki-highlighted pre of whichever side is selected. Defaults to Before.
 */
export function BeforeAfter({ block }: { block: BeforeAfterBlock }) {
  const [showAfter, setShowAfter] = useState(false)
  const code = showAfter ? block.after : block.before
  const caption = showAfter ? (block.titleAfter ?? 'After') : (block.titleBefore ?? 'Before')

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line2 bg-elev px-3.5 py-[9px]">
        <span className="font-mono text-[10.5px] tracking-[.04em] text-faint">{caption}</span>
        <div className="flex items-center gap-0.5 rounded-lg bg-chip p-0.5">
          <button
            type="button"
            onClick={() => setShowAfter(false)}
            aria-pressed={showAfter === false}
            className={segmentClass(!showAfter)}
          >
            Before
          </button>
          <button
            type="button"
            onClick={() => setShowAfter(true)}
            aria-pressed={showAfter === true}
            className={segmentClass(showAfter)}
          >
            After
          </button>
        </div>
      </div>
      <CodePre code={code} language={block.language} />
    </div>
  )
}
