'use client'
import { useState } from 'react'
import type { Block } from '@brief/schema'
import { CardCaption } from '../CardCaption'
import type { BlockAnchor } from '../blockAnchor'
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
 *
 * The header is the title of whichever side is showing, and it is annotatable
 * when the payload supplies one: the two sides are separate leaves
 * (`titleBefore`, `titleAfter`), so a highlight on one does not bleed onto the
 * other. A side with no title shows the plain 'Before'/'After' chrome label,
 * which is not in the payload and so is not annotatable.
 */
export function BeforeAfter({
  block,
  pathPrefix = '',
  annotatable = true,
  ...anchor
}: { block: BeforeAfterBlock } & BlockAnchor) {
  const [showAfter, setShowAfter] = useState(false)
  const code = showAfter ? block.after : block.before
  const title = showAfter ? block.titleAfter : block.titleBefore
  const caption = title ?? (showAfter ? 'After' : 'Before')

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-line2 bg-elev px-3.5 py-[9px]">
        <CardCaption
          {...anchor}
          text={caption}
          path={`${pathPrefix}${showAfter ? 'titleAfter' : 'titleBefore'}`}
          annotatable={annotatable && title !== undefined}
        />
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-chip p-0.5">
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
      <CodePre
        code={code}
        language={block.language}
        pathPrefix={pathPrefix}
        field={showAfter ? 'after' : 'before'}
        annotatable={annotatable}
        {...anchor}
      />
    </div>
  )
}
