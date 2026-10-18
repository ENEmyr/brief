'use client'
import { useMemo, useState, type ReactNode } from 'react'
import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import { useReaderState } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { CodePanel, CodeRow, PrintedNotes, type LineTone } from './CodePre'
import { notesByLine, placeNotes } from './codeNotes'
import { diffLines } from './lineDiff'

type BeforeAfterBlock = Extract<Block, { type: 'ba' }>
type View = 'split' | 'unified'
type Side = 'before' | 'after'

/** B-Blocks:142: the selected view has the control border and fill, the other is bare faint text. */
function viewButtonClass(active: boolean): string {
  const base = 'min-h-7 rounded-[4px] px-2 font-mono text-[11px] max-[880px]:min-h-11'
  return active
    ? `${base} border border-line2 bg-elev text-text`
    : `${base} border-0 bg-transparent text-faint`
}

/**
 * B-Blocks:141-160. Split shows both sides with removed lines on the bad tint
 * and added lines on the good tint; Unified (no board draws it) shows one
 * listing in diff order. Every line keeps its own leaf (`before.N`,
 * `after.N`) in both views; an unchanged line in Unified is the after line.
 * The code is plain text: the board draws no syntax colour.
 */
export function BeforeAfter({
  block,
  pathPrefix = '',
  annotatable = true,
  ...anchor
}: { block: BeforeAfterBlock } & BlockAnchor) {
  const [view, setView] = useState<View>('split')
  const { highlights } = useReaderState()
  const lines = useMemo(
    () => ({ before: block.before.split('\n'), after: block.after.split('\n') }),
    [block.before, block.after],
  )
  const { rows, removed, added } = useMemo(() => {
    const rows = diffLines(lines.before, lines.after)
    return {
      rows,
      removed: new Set(rows.flatMap((r) => (r.kind === 'del' ? [r.before] : []))),
      added: new Set(rows.flatMap((r) => (r.kind === 'add' ? [r.after] : []))),
    }
  }, [lines])

  const placed = useMemo(
    () => placeNotes(block.notes, { before: lines.before.length, after: lines.after.length }),
    [block.notes, lines],
  )
  const byLine = useMemo(() => notesByLine(placed), [placed])

  const sides = {
    before: { title: block.titleBefore, changed: removed, tone: 'del' },
    after: { title: block.titleAfter, changed: added, tone: 'add' },
  } as const
  const row = (side: Side, index: number, tone: LineTone | undefined) => (
    <CodeRow
      key={`${side}.${index}`}
      node={undefined}
      text={lines[side][index] ?? ''}
      number={index + 1}
      gutter="w-7"
      tone={tone}
      notes={byLine.get(`${side}.${index}`)}
      path={`${pathPrefix}${side}.${index}`}
      annotatable={annotatable}
      highlights={highlights}
      {...anchor}
    />
  )
  const label = (side: Side) => {
    const title = sides[side].title
    return title === undefined ? (
      side
    ) : (
      <Annotatable
        sid={anchor.sid}
        bid={anchor.bid ?? null}
        annotatable={annotatable && anchor.bid !== undefined}
        onMarkClick={anchor.onMarkClick}
        className="break-words"
        text={title}
        path={`${pathPrefix}${side === 'before' ? 'titleBefore' : 'titleAfter'}`}
      />
    )
  }

  const toggle = (
    <span className="flex shrink-0 items-center gap-2">
      {(['split', 'unified'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={viewButtonClass(view === v)}
        >
          {v === 'split' ? 'Split' : 'Unified'}
        </button>
      ))}
    </span>
  )

  return (
    <BlockCard
      {...cardHeader(block, { ...anchor, pathPrefix, annotatable })}
      captionSuffix={block.filename === undefined ? undefined : 'before and after'}
      controls={toggle}
    >
      <div
        data-ba-body=""
        className={`font-mono text-[13px] leading-[22px] ${view === 'split' ? 'grid grid-cols-2 max-[880px]:grid-cols-1' : ''}`}
      >
        {view === 'split' ? (
          (['before', 'after'] as const).map((side) => (
            <Pane key={side} label={label(side)} divider={side === 'before'}>
              {lines[side].map((_, i) =>
                row(side, i, sides[side].changed.has(i) ? sides[side].tone : undefined),
              )}
            </Pane>
          ))
        ) : (
          <Pane
            label={
              <>
                {label('before')} / {label('after')}
              </>
            }
            divider={false}
          >
            {rows.map((r) =>
              r.kind === 'del'
                ? row('before', r.before, 'del')
                : row('after', r.after, r.kind === 'add' ? 'add' : undefined),
            )}
          </Pane>
        )}
      </div>
      <PrintedNotes notes={placed} />
    </BlockCard>
  )
}

function Pane({
  label,
  divider,
  children,
}: {
  label: ReactNode
  divider: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`min-w-0 py-2 ${divider ? 'border-r border-line max-[880px]:border-r-0 max-[880px]:border-b' : ''}`}
    >
      <div className="px-3 pb-1.5 text-[11px] text-faint">{label}</div>
      <CodePanel highlighted={null}>{children}</CodePanel>
    </div>
  )
}
