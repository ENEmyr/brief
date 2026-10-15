'use client'
import { useMemo, useState } from 'react'
import type { DiffBlock, DiffChange } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { FOCUS_RING } from '../topbarChrome'
import { parsePatch, patchCounts, type PatchLine, type PatchLineKind } from './diffPatch'

type Mode = 'semantic' | 'raw'
type DiffFile = DiffBlock['files'][number]
type MapNode = NonNullable<DiffBlock['map']>['nodes'][number]

const FILE_STATUS: Record<DiffFile['status'], { letter: string; text: string }> = {
  added: { letter: 'A', text: 'text-good' },
  modified: { letter: 'M', text: 'text-warn' },
  deleted: { letter: 'D', text: 'text-bad' },
  renamed: { letter: 'R', text: 'text-info' },
}

const MAP_STATUS: Record<
  NonNullable<MapNode['status']>,
  { letter: string; fill: string; text: string }
> = {
  added: { letter: 'A', fill: 'bg-good', text: 'text-good' },
  modified: { letter: 'M', fill: 'bg-warn', text: 'text-warn' },
  deleted: { letter: 'D', fill: 'bg-bad', text: 'text-bad' },
}

/** B-NewBlocks:177,191: each change kind is a soft chip in its tone. */
const CHANGE_CHIP: Record<DiffChange['change'], string> = {
  added: 'bg-good-soft text-good',
  modified: 'bg-warn-soft text-warn',
  removed: 'bg-bad-soft text-bad',
  moved: 'bg-info-soft text-info',
  config: 'bg-warn-soft text-warn',
}

/** B-NewBlocks:201-207: hunk headers in info, added and removed lines on the good and bad tints. */
const RAW_TONE: Record<PatchLineKind, string> = {
  hunk: 'text-info',
  add: 'bg-good-soft',
  del: 'bg-bad-soft',
  ctx: '',
}

const TOUCH = 'max-[880px]:min-h-11 max-[880px]:min-w-11'

function modeButtonClass(active: boolean): string {
  const base = `min-h-[26px] rounded-[3px] border-0 px-2 font-mono text-[11px] ${TOUCH} ${FOCUS_RING}`
  return active ? `${base} bg-chip text-text` : `${base} bg-transparent text-faint`
}

/**
 * B-NewBlocks:153-209. The file list and the views sit side by side while
 * 260 + 560 px fit in the card, as the board's flex-wrap does, and stack
 * below that. The changed-files list scopes both views to one file
 * (pressed again, back to all). Semantic lists each change with the agent's
 * note and, for an added function, its steps; raw prints the patch as text.
 */
export function Diff({
  block,
  pathPrefix = '',
  annotatable = true,
  ...anchor
}: { block: DiffBlock } & BlockAnchor) {
  const [mode, setMode] = useState<Mode>('semantic')
  const [only, setOnly] = useState<number | null>(null)
  const [opened, setOpened] = useState<ReadonlySet<number>>(
    () => new Set(block.files.flatMap((file, i) => (file.folded ? [] : [i]))),
  )
  const [closedNotes, setClosedNotes] = useState<ReadonlySet<string>>(() => new Set())

  const patches = useMemo(
    () =>
      block.files.map((file) => {
        const lines = file.patch === undefined ? [] : parsePatch(file.patch)
        return { lines, ...patchCounts(lines) }
      }),
    [block.files],
  )
  const totals = patches.reduce(
    (sum, p) => ({ added: sum.added + p.added, removed: sum.removed + p.removed }),
    { added: 0, removed: 0 },
  )
  const visible = only === null ? block.files.map((_, i) => i) : [only]

  const leaf = (text: string, path: string, className?: string) => (
    <Annotatable
      sid={anchor.sid}
      bid={anchor.bid ?? null}
      annotatable={annotatable && anchor.bid !== undefined}
      onMarkClick={anchor.onMarkClick}
      className={className}
      text={text}
      path={`${pathPrefix}${path}`}
    />
  )

  const pickFile = (i: number) => {
    setOnly(only === i ? null : i)
    setOpened((prev) => new Set(prev).add(i))
  }
  const toggleOpen = (i: number) =>
    setOpened((prev) => {
      const next = new Set(prev)
      if (!next.delete(i)) next.add(i)
      return next
    })
  const toggleNote = (key: string) =>
    setClosedNotes((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const modeGroup = (
    <div
      role="group"
      aria-label="Diff mode"
      className="flex shrink-0 gap-0.5 rounded-[4px] border border-line bg-page p-0.5"
    >
      {(['semantic', 'raw'] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={modeButtonClass(mode === m)}
        >
          {m}
        </button>
      ))}
    </div>
  )

  const fileHeader = (file: DiffFile, i: number) => {
    const status = FILE_STATUS[file.status]
    const folded = !opened.has(i)
    return (
      <div className="flex min-h-8 flex-wrap items-center gap-2 px-3.5 pt-2.5 font-mono text-[11px] text-faint">
        <span className={status.text}>{status.letter}</span>
        <span className="min-w-0 flex-1 break-all">
          {file.from === undefined ? null : (
            <>
              {leaf(file.from, `files.${i}.from`)}
              {' -> '}
            </>
          )}
          {leaf(file.path, `files.${i}.path`)}
        </span>
        {file.folded ? (
          <button
            type="button"
            aria-expanded={!folded}
            onClick={() => toggleOpen(i)}
            className={`min-h-7 rounded-[4px] border border-line2 bg-elev px-2 font-mono text-[11px] text-text ${TOUCH} ${FOCUS_RING}`}
          >
            {folded ? 'Unfold' : 'Fold'}
          </button>
        ) : null}
      </div>
    )
  }

  const semanticFile = (file: DiffFile, i: number) => {
    const changes = file.changes ?? []
    return (
      <section key={i} aria-label={file.path} className="border-b border-line last:border-b-0">
        {fileHeader(file, i)}
        {!opened.has(i) ? (
          <div className="pb-2.5" />
        ) : changes.length === 0 ? (
          <p className="m-0 px-3.5 pb-3 pt-1 text-[12px] text-faint">No notes for this file.</p>
        ) : (
          changes.map((change, c) => {
            const key = `${i}.${c}`
            const noteOpen = !closedNotes.has(key)
            const at = `files.${i}.changes.${c}`
            return (
              <div
                key={c}
                className="flex flex-col gap-2 border-t border-line px-3.5 py-3 first-of-type:border-t-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-[3px] px-1.5 py-px font-mono text-[11px] ${CHANGE_CHIP[change.change]}`}
                  >
                    {change.change}
                  </span>
                  {leaf(change.symbol, `${at}.symbol`, 'break-all font-mono text-[13px]')}
                  {change.steps === undefined ? null : (
                    <span className="text-[12px] text-faint">
                      {change.steps.length} {change.steps.length === 1 ? 'step' : 'steps'}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-expanded={noteOpen}
                    onClick={() => toggleNote(key)}
                    className={`ml-auto min-h-7 rounded-[4px] border border-info-line px-2 text-[12px] text-info ${noteOpen ? 'bg-info-soft' : 'bg-transparent'} ${TOUCH} ${FOCUS_RING}`}
                  >
                    ◆ agent: what it does
                  </button>
                </div>
                {noteOpen ? (
                  <div
                    data-diff-note
                    className="rounded-[4px] border border-info-line bg-info-soft px-2.5 py-2 text-[13px] leading-5"
                  >
                    {leaf(change.summary, `${at}.summary`, 'break-words')}
                  </div>
                ) : null}
                {change.steps === undefined ? null : (
                  <ol className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] leading-5">
                    {change.steps.map((step, s) => (
                      <li key={s} className="flex gap-2.5">
                        <span className="font-mono text-accent-text">{s + 1}</span>
                        {leaf(step, `${at}.steps.${s}`, 'min-w-0 break-words')}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })
        )}
      </section>
    )
  }

  const rawFile = (file: DiffFile, i: number) => (
    <section key={i} aria-label={file.path} className="border-b border-line last:border-b-0">
      {fileHeader(file, i)}
      {!opened.has(i) ? (
        <div className="pb-2.5" />
      ) : file.patch === undefined ? (
        <p className="m-0 px-3.5 pb-3 pt-1 text-[12px] text-faint">No patch for this file.</p>
      ) : (
        <div className="overflow-x-auto py-2.5 font-mono text-[12.5px] leading-[21px]">
          <div className="w-max min-w-full">
            {patches[i]?.lines.map((line: PatchLine, n) => (
              <div
                key={n}
                data-line={line.kind}
                className={`whitespace-pre px-3.5 ${RAW_TONE[line.kind]}`}
              >
                {line.text === '' ? ' ' : line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )

  const changed = new Set(
    (block.map?.nodes ?? []).flatMap((node) => (node.status === undefined ? [] : [node.id])),
  )
  const nested = new Set(
    (block.map?.edges ?? []).flatMap((edge) =>
      changed.has(edge.from) && edge.from !== edge.to ? [edge.to] : [],
    ),
  )

  return (
    <BlockCard
      {...cardHeader(block, { ...anchor, pathPrefix, annotatable })}
      captionSuffix={`${block.files.length} ${block.files.length === 1 ? 'file' : 'files'}`}
      meta={
        <span className="flex shrink-0 gap-2">
          <span className="text-good">+{totals.added}</span>
          <span className="text-bad">−{totals.removed}</span>
        </span>
      }
      controls={modeGroup}
    >
      <div className="@container">
        <div className="flex @max-[820px]:flex-col">
          <nav
            aria-label="Changed files"
            className="flex shrink-0 basis-[260px] flex-col gap-0.5 border-r border-line p-2 text-[13px] @max-[820px]:basis-auto @max-[820px]:border-b @max-[820px]:border-r-0"
          >
            {block.map === undefined ? null : (
              <>
                <span className="px-2 py-1.5 font-mono text-[10px] text-faint">CHANGE MAP</span>
                <ul
                  aria-label="Change map"
                  className="m-0 flex list-none flex-col gap-1.5 px-2 pb-3 pt-1 text-[12px]"
                >
                  {block.map.nodes.map((node) => {
                    const status = node.status === undefined ? undefined : MAP_STATUS[node.status]
                    return (
                      <li
                        key={node.id}
                        data-diff-node={node.id}
                        className={`flex items-center gap-2 ${nested.has(node.id) ? 'pl-4' : ''}`}
                      >
                        <span
                          aria-hidden
                          className={`size-2 shrink-0 rounded-[2px] ${status === undefined ? 'border border-faint' : status.fill}`}
                        />
                        <span
                          className={`min-w-0 break-words ${status === undefined ? 'text-sub' : ''}`}
                        >
                          {node.label}
                        </span>
                        {status === undefined ? null : (
                          <span className={`font-mono text-[10px] ${status.text}`}>
                            {status.letter}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            <span className="px-2 py-1.5 font-mono text-[10px] text-faint">FILES</span>
            {block.files.map((file, i) => {
              const status = FILE_STATUS[file.status]
              const active = only === i
              const tone = active ? 'bg-chip text-text' : file.folded ? 'text-faint' : 'text-sub'
              const counts = patches[i]
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickFile(i)}
                  className={`flex min-h-8 items-center gap-2 rounded-[4px] border-0 px-2 text-left ${tone} ${active ? '' : 'bg-transparent hover:bg-chip'} ${TOUCH} ${FOCUS_RING}`}
                >
                  <span className={`w-3 shrink-0 font-mono text-[11px] ${status.text}`}>
                    {status.letter}
                  </span>
                  <span className="min-w-0 flex-1 break-all font-mono text-[12px]">
                    {file.path}
                  </span>
                  {file.folded ? (
                    <span className="shrink-0 font-mono text-[11px]">folded</span>
                  ) : counts !== undefined && counts.added + counts.removed > 0 ? (
                    <span className="flex shrink-0 gap-1.5 font-mono text-[11px]">
                      {counts.added > 0 ? <span className="text-good">+{counts.added}</span> : null}
                      {counts.removed > 0 ? (
                        <span className="text-bad">−{counts.removed}</span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col" data-diff-mode={mode}>
            {visible.map((i) => {
              const file = block.files[i]
              if (file === undefined) return null
              return mode === 'semantic' ? semanticFile(file, i) : rawFile(file, i)
            })}
          </div>
        </div>
      </div>
    </BlockCard>
  )
}
