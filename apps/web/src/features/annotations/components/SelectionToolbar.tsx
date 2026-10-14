'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DEFAULT_HIGHLIGHT_PATH, useReaderActions } from '@/features/reader-state'
import { useShortcuts } from '@/features/shortcuts'
import { selectionRangeIn } from '../lib/offsets'
import { defaultCopyText } from '../lib/clipboard'

type ToolbarState = {
  x: number
  top: number
  sid: number
  bid: number | null
  path: string
  start: number
  end: number
  text: string
}

const VIEWPORT_MARGIN = 8

/** The center x that keeps a bar this wide inside the viewport margins, not just its center. */
function centerKeepingBarOnScreen(x: number, width: number): number {
  const lowest = VIEWPORT_MARGIN + width / 2
  return Math.min(Math.max(x, lowest), Math.max(window.innerWidth - VIEWPORT_MARGIN - width / 2, lowest))
}
const TOOLBAR_RISE = 46
const BELOW_SELECTION_GAP = 8
const FLIP_BELOW_THRESHOLD = 56

function findHlBlock(node: Node | null): HTMLElement | null {
  let el = node
  while (el && el.nodeType === Node.TEXT_NODE) el = el.parentNode
  return el instanceof Element ? el.closest<HTMLElement>('[data-hl]') : null
}

// As on the board, only Highlight is a flex row (swatch, label, key); Note
// and Ask set their key inline, on the label's baseline.
const BUTTON =
  'min-h-[30px] cursor-pointer rounded-ctrl border-0 bg-transparent px-[9px] font-[inherit] text-[13px] text-page transition-transform duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line max-[880px]:min-h-11'
const KEY = 'font-mono text-[10px] text-[var(--c-inverse-sub)]'

/** The inverted toolbar on a text selection inside a [data-hl] block
 * (B-Components:146-151). Listens on document so it works regardless of
 * which paragraph the selection started in. */
export function SelectionToolbar({
  onRequestNote = () => {},
  onRequestAsk = () => {},
  copyText = defaultCopyText,
}: {
  onRequestNote?: (id: string) => void
  onRequestAsk?: (id: string) => void
  copyText?: (text: string) => void
}) {
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null)
  const actions = useReaderActions()
  const barRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const width = barRef.current?.offsetWidth
    if (!toolbar || !width) return
    const x = centerKeepingBarOnScreen(toolbar.x, width)
    if (x !== toolbar.x) setToolbar({ ...toolbar, x })
  }, [toolbar])

  useEffect(() => {
    function handleMouseUp() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setToolbar(null)
        return
      }
      const range = sel.getRangeAt(0)
      const block = findHlBlock(range.startContainer)
      // A highlight addresses ONE leaf, so a selection that starts in one and
      // ends in another has no honest anchor. Refuse it rather than quietly
      // storing the part that fits.
      if (!block || findHlBlock(range.endContainer) !== block) {
        setToolbar(null)
        return
      }
      const result = selectionRangeIn(block, sel)
      if (!result) {
        setToolbar(null)
        return
      }
      const rect = range.getBoundingClientRect()
      const x = Math.min(
        Math.max(rect.left + rect.width / 2, VIEWPORT_MARGIN),
        window.innerWidth - VIEWPORT_MARGIN,
      )
      const top = rect.top < FLIP_BELOW_THRESHOLD ? rect.bottom + BELOW_SELECTION_GAP : rect.top - TOOLBAR_RISE
      const bidAttr = block.dataset.bid
      setToolbar({
        x,
        top,
        sid: Number(block.dataset.sid),
        // Absent for a section heading, which is not a block.
        bid: bidAttr === undefined ? null : Number(bidAttr),
        path: block.dataset.path ?? DEFAULT_HIGHLIGHT_PATH,
        start: result.start,
        end: result.end,
        text: result.text,
      })
    }

    function handleKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setToolbar(null)
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function finish() {
    window.getSelection()?.removeAllRanges()
    setToolbar(null)
  }

  /** The anchor is identical for all three actions; only note/question differ. */
  function anchorFrom(state: ToolbarState, id: string) {
    return {
      id,
      sid: state.sid,
      bid: state.bid,
      path: state.path,
      start: state.start,
      end: state.end,
      text: state.text,
    }
  }

  function handleHighlight() {
    if (!toolbar) return
    actions.addHighlight({ ...anchorFrom(toolbar, `h${Date.now()}`), note: null })
    finish()
  }

  function handleNote() {
    if (!toolbar) return
    const id = `h${Date.now()}`
    actions.addHighlight({ ...anchorFrom(toolbar, id), note: '' })
    onRequestNote(id)
    finish()
  }

  function handleAsk() {
    if (!toolbar) return
    const id = `h${Date.now()}`
    actions.addHighlight({ ...anchorFrom(toolbar, id), note: null, question: '' })
    onRequestAsk(id)
    finish()
  }

  function handleCopy() {
    if (!toolbar) return
    copyText(toolbar.text)
    finish()
  }

  useShortcuts({
    highlight: handleHighlight,
    note: handleNote,
    ask: handleAsk,
  })

  if (!toolbar) return null

  return (
    <div
      // Styled inline, so `print:hidden` (a class) cannot beat its own
      // `display: flex`. The print stylesheet hides it by this attribute
      // instead, same idiom as ZoomControls' data-zbar.
      ref={barRef}
      data-seltoolbar="1"
      className="console-pop"
      style={{
        position: 'fixed',
        left: toolbar.x,
        top: toolbar.top,
        // `translate`, not `transform`, so console-pop's entry transform cannot undo the centering.
        translate: '-50% 0',
        zIndex: 80,
        background: 'var(--c-text)',
        borderRadius: 6,
        padding: 3,
        display: 'flex',
        gap: 2,
        boxShadow: 'var(--shadow-overlay)',
        lineHeight: 'normal',
      }}
    >
      <button
        type="button"
        aria-label="Highlight"
        aria-keyshortcuts="H"
        className={`${BUTTON} flex items-center gap-[6px]`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleHighlight}
      >
        <span aria-hidden="true" className="size-[9px] rounded-[2px] bg-[var(--c-warn-fill)]" />
        Highlight
        <kbd aria-hidden="true" className={KEY}>
          H
        </kbd>
      </button>
      <button
        type="button"
        aria-label="Note"
        aria-keyshortcuts="N"
        className={BUTTON}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleNote}
      >
        Note
        <kbd aria-hidden="true" className={`${KEY} ml-[6px]`}>
          N
        </kbd>
      </button>
      <button
        type="button"
        aria-label="Ask"
        aria-keyshortcuts="A"
        className={BUTTON}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleAsk}
      >
        Ask
        <kbd aria-hidden="true" className={`${KEY} ml-[6px]`}>
          A
        </kbd>
      </button>
      <button
        type="button"
        aria-label="Copy"
        className={BUTTON}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleCopy}
      >
        Copy
      </button>
    </div>
  )
}
