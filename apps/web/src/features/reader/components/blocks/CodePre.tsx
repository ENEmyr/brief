'use client'
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { jsx, jsxs } from 'react/jsx-runtime'
import type { Element as HastElement } from 'hast'
import { useReaderState } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import { highlightToHast } from '../../services/shiki'
import type { BlockAnchor } from '../blockAnchor'
import { FOCUS_RING } from '../topbarChrome'
import { notesByLine, type PlacedNote } from './codeNotes'
import {
  extractLineNodes,
  highlightsForLine,
  lineClassName,
  preAttrsFrom,
  renderLineChildren,
  sameHighlightList,
  type PreAttrs,
} from './codeLines'

export type LineTone = 'mark' | 'del' | 'add'

const ROW_TONE: Record<LineTone, { row: string; number: string }> = {
  mark: { row: 'bg-[var(--c-code-line)]', number: 'text-faint' },
  del: { row: 'bg-bad-soft', number: 'text-bad' },
  add: { row: 'bg-good-soft', number: 'text-good' },
}

/**
 * One annotatable code line. Each `<span class="line">` shiki emits becomes
 * its own `[data-hl]` leaf at path `<field>.<index>` (`code.3`, `before.0`,
 * `after.12`) -- the same one-leaf-per-string rule as every other block, just
 * applied per line instead of per block, since a code block's flattened text
 * has no single honest offset space (a highlight's offsets must count into
 * ONE line, not the whole body with its embedded newlines).
 *
 * Converting a line's coloured token spans to JSX (`toJsxRuntime`) is the
 * expensive part of rendering a highlighted line, so it's memoized behind
 * `stable`: reader-state replaces the whole `highlights` array on every
 * mutation, but keeps untouched Highlight objects by reference, so an edit
 * to one line's highlight leaves every other line's filtered subset
 * reference-equal to what it was last render (see sameHighlightList). That
 * is what keeps an unrelated highlight elsewhere in the document from
 * re-converting all 500 lines of an unrelated code block.
 */
const CodeLine = memo(function CodeLine({
  node,
  text,
  sid,
  bid,
  path,
  annotatable,
  highlights,
  onMarkClick,
}: {
  node: HastElement
  text: string
  sid?: number
  bid: number | null
  path: string
  annotatable: boolean
  highlights: Highlight[]
  onMarkClick: (highlight: Highlight) => void
}) {
  const matches = highlightsForLine(highlights, sid, bid, path, text)
  const stableRef = useRef<Highlight[]>(matches)
  const stable = sameHighlightList(stableRef.current, matches) ? stableRef.current : matches
  stableRef.current = stable

  const rendered = useMemo(
    () => toJsxRuntime({ type: 'root', children: renderLineChildren(node, stable) }, { Fragment, jsx, jsxs }),
    [node, stable],
  )

  const canAnnotate = annotatable && sid !== undefined && text.length > 0
  const className = lineClassName(node)

  function handleClick(ev: ReactMouseEvent<HTMLSpanElement>) {
    if (!stable.length) return
    const target = ev.target
    if (!(target instanceof Element)) return
    const id = target.closest('mark[data-mark-id]')?.getAttribute('data-mark-id')
    const hit = id === null || id === undefined ? undefined : stable.find((h) => h.id === id)
    if (hit) onMarkClick(hit)
  }

  return (
    <span
      className={className}
      onClick={stable.length ? handleClick : undefined}
      {...(canAnnotate
        ? {
            'data-hl': '',
            'data-sid': sid,
            ...(bid === null ? {} : { 'data-bid': bid }),
            'data-path': path,
          }
        : {})}
    >
      {rendered}
      {/* A row is a block, and a copy gives an empty block no newline; the
          <br> is the blank line. Empty lines are never [data-hl] leaves. */}
      {text ? null : <br />}
    </span>
  )
})

export interface HighlightedCode {
  lines: HastElement[]
  pre: PreAttrs
}

/**
 * Shiki's highlighted lines for `code`, or null until the lazy highlighter
 * resolves (the rows show plain text meanwhile, so code is never blocked on
 * it). The tree is rendered as React elements via hast-util-to-jsx-runtime
 * rather than `dangerouslySetInnerHTML`: nothing else makes the code
 * annotatable, since the annotation model measures and repaints highlights by
 * walking and re-rendering the React tree. Per-line annotation loses
 * cross-line selection (the toolbar only appears when a selection resolves to
 * one `[data-hl]` leaf, same as every other block), which is accepted.
 */
export function useHighlightedCode(code: string, language: string): HighlightedCode | null {
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null)

  useEffect(() => {
    let cancelled = false
    setHighlighted(null)
    highlightToHast(code, language)
      .then((hast) => {
        if (!cancelled) setHighlighted({ lines: extractLineNodes(hast), pre: preAttrsFrom(hast) })
      })
      .catch(() => {
        // highlightToHast() itself already falls back to plaintext internally
        // and should not reject; this guard just guarantees a rejected mock
        // (or an unforeseen failure) never leaves the component stuck
        // rendering the plain fallback forever without throwing.
      })
    return () => {
      cancelled = true
    }
  }, [code, language])

  return highlighted
}

function plainLine(text: string): HastElement {
  return {
    type: 'element',
    tagName: 'span',
    properties: { class: 'line' },
    children: text ? [{ type: 'text', value: text }] : [],
  }
}

/**
 * The code panel: shiki's `<pre>` class and colors once highlighted, the
 * plain panel before. Rows fill the scroll width, so a tinted row runs to the
 * edge however long its line. `data-code-panel` lets the print rules find the
 * panel before shiki's `.shiki` class arrives; only a marked row
 * (`data-tone="mark"`) keeps its tint on paper.
 */
export function CodePanel({
  highlighted,
  className = '',
  children,
}: {
  highlighted: HighlightedCode | null
  className?: string
  children: ReactNode
}) {
  const pre = highlighted?.pre
  return (
    <pre
      data-code-panel={pre ? undefined : ''}
      className={`m-0 overflow-x-auto font-mono [container-type:inline-size] ${className} ${pre?.className ?? ''}`}
      style={pre?.style ?? { color: 'var(--c-text)' }}
      tabIndex={pre?.tabIndex}
    >
      <code className="inline-block min-w-full">{children}</code>
    </pre>
  )
}

/**
 * One row: the line number in a gutter, then the line itself. The gutter sits
 * outside the line's `[data-hl]` leaf, so a highlight's offsets still count
 * into the line text alone, and it is neither read out nor copied.
 */
export function CodeRow({
  node,
  text,
  number,
  gutter,
  inset = 'px-3',
  tone,
  notes = NO_NOTES,
  sid,
  bid,
  path,
  annotatable,
  highlights,
  onMarkClick,
}: {
  node: HastElement | undefined
  text: string
  number: number
  /** Width class of the gutter: the boards draw 26 for code, 28 for before and after. */
  gutter: string
  /** Row padding; the walkthrough's rows sit 10 after the hunk bar (B-NewBlocks:53). */
  inset?: string
  tone?: LineTone
  /** Agent notes whose range ends on this line (B-NewBlocks:126-131). */
  notes?: PlacedNote[]
  sid?: number
  bid?: number
  path: string
  annotatable: boolean
  highlights: Highlight[]
  onMarkClick?: (highlight: Highlight) => void
}) {
  const style = tone === undefined ? undefined : ROW_TONE[tone]
  // A stable plain line until shiki's arrives, so CodeLine's memo holds.
  const line = useMemo(() => node ?? plainLine(text), [node, text])
  const [pinned, setPinned] = useState<ReadonlySet<string>>(NO_PINS)
  const setPin = (key: string, on: boolean) =>
    setPinned((prev) => {
      if (prev.has(key) === on) return prev
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  const row = (
    <span
      data-tone={tone}
      className={`flex ${inset} ${style?.row ?? ''} ${notes.length ? `group/row ${style ? '' : 'hover:bg-[var(--c-code-line)]'}` : ''}`}
    >
      <span
        aria-hidden="true"
        className={`${gutter} shrink-0 select-none ${style?.number ?? 'text-faint'}`}
      >
        {number}
      </span>
      <CodeLine
        node={line}
        text={text}
        sid={sid}
        bid={bid ?? null}
        path={path}
        annotatable={annotatable}
        highlights={highlights}
        onMarkClick={onMarkClick ?? ignoreMarkClick}
      />
      {notes.map((note) => (
        <NoteMarker
          key={note.key}
          note={note}
          pinned={pinned.has(note.key)}
          onPin={(on) => setPin(note.key, on)}
        />
      ))}
    </span>
  )
  if (!notes.length) return row
  return (
    <>
      {row}
      {notes.map((note) =>
        pinned.has(note.key) ? <PinnedNote key={note.key} note={note} /> : null,
      )}
    </>
  )
}

const NO_NOTES: PlacedNote[] = []
const NO_PINS: ReadonlySet<string> = new Set()

/**
 * The diamond at the end of a noted line (B-NewBlocks:127-129). Hovering the
 * row or focusing the diamond shows the note as ghost text; Enter or a click
 * pins it under the line and the diamond becomes the bordered "note" chip;
 * Escape unpins. It sits outside the line's [data-hl] leaf and is unselectable,
 * so highlight offsets and copied code never see it.
 */
function NoteMarker({
  note,
  pinned,
  onPin,
}: {
  note: PlacedNote
  pinned: boolean
  onPin: (on: boolean) => void
}) {
  function handleKeyDown(ev: ReactKeyboardEvent<HTMLButtonElement>) {
    if (ev.key === 'Escape' && pinned) {
      ev.stopPropagation()
      onPin(false)
    }
  }
  return (
    <>
      <button
        type="button"
        data-code-note={note.range}
        aria-expanded={pinned}
        aria-label={`Agent note ${note.range}`}
        onClick={() => onPin(!pinned)}
        onKeyDown={handleKeyDown}
        className={`group/note relative ml-3 inline-flex min-h-6 shrink-0 select-none items-center self-center whitespace-nowrap rounded-[3px] border px-1.5 font-mono text-[11px] leading-[22px] text-info max-[880px]:min-h-11 max-[880px]:min-w-11 max-[880px]:justify-center print:hidden ${pinned ? 'border-info-line bg-info-soft' : 'border-transparent bg-transparent'} ${FOCUS_RING}`}
      >
        <span aria-hidden="true">{pinned ? '\u25C6 note' : '\u25C6'}</span>
        {pinned ? null : (
          <span
            data-code-note-ghost=""
            className="console-fade ml-1 hidden font-sans text-[12px] group-hover/row:inline group-focus-visible/note:inline"
          >
            {note.text}
          </span>
        )}
      </button>
      <span
        aria-hidden="true"
        data-print-letter={note.letter}
        className="hidden select-none print:ml-3 print:inline"
      />
    </>
  )
}

/** B-NewBlocks:131: the pinned note, under the line, labelled with its range. */
function PinnedNote({ note }: { note: PlacedNote }) {
  return (
    <span
      data-code-note-pinned={note.range}
      className="console-pop sticky left-[38px] mt-1 mb-1.5 ml-[38px] flex w-[calc(100cqw-50px)] select-none flex-col gap-1 whitespace-normal rounded-[4px] border border-info-line bg-info-soft px-3 py-2.5 font-sans text-[13px] leading-5 text-text [contain:inline-size] print:hidden"
    >
      <span className="font-mono text-[10px] leading-normal text-info">AGENT / {note.range}</span>
      {note.text}
    </span>
  )
}

/** B-Print:55-67: agent notes print as a lettered list under the card, outside
    its rule. The wrapper has no box on screen, so the card lays out as before. */
export function WithPrintedNotes({ notes, children }: { notes: readonly PlacedNote[]; children: ReactNode }) {
  if (!notes.length) return children
  return (
    <div className="contents print:block">
      {children}
      <ol data-print-notes="" className="hidden list-none print:block">
        {notes.map((note) => (
          <li key={note.key}>
            <b>[{note.letter}]</b> {note.text}
          </li>
        ))}
      </ol>
    </div>
  )
}

// One function for every row, so CodeLine's memo sees the same prop.
function ignoreMarkClick() {}

/** The code block's body (B-NewBlocks:125-135): 13/24 mono rows, a 26px gutter. */
export function CodePre({
  code,
  language,
  highlightLines,
  placed,
  pathPrefix = '',
  annotatable = true,
  ...anchor
}: {
  code: string
  language: string
  /** 1-based lines the agent marked (code.highlight); tinted as on B-Reader:157. */
  highlightLines?: number[]
  /** The block's notes after placeNotes, so the card's printed list shares the letters. */
  placed: readonly PlacedNote[]
} & BlockAnchor) {
  const highlighted = useHighlightedCode(code, language)
  const { highlights } = useReaderState()
  const marked = new Set(highlightLines)
  const lines = code.split('\n')
  const byLine = useMemo(() => notesByLine(placed), [placed])

  return (
    <CodePanel highlighted={highlighted} className="py-2 text-[13px] leading-6">
      {lines.map((text, i) => (
        <CodeRow
          key={i}
          node={highlighted?.lines[i]}
          text={text}
          number={i + 1}
          gutter="w-[26px]"
          tone={marked.has(i + 1) ? 'mark' : undefined}
          notes={byLine.get(`code.${i}`)}
          path={`${pathPrefix}code.${i}`}
          annotatable={annotatable}
          highlights={highlights}
          {...anchor}
        />
      ))}
    </CodePanel>
  )
}
