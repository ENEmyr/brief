'use client'
import { useEffect, useState } from 'react'
import { DEFAULT_HIGHLIGHT_PATH, useReaderActions } from '@/features/reader-state'
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
const TOOLBAR_RISE = 46
const BELOW_SELECTION_GAP = 8
const FLIP_BELOW_THRESHOLD = 56

function findHlBlock(node: Node | null): HTMLElement | null {
  let el = node
  while (el && el.nodeType === Node.TEXT_NODE) el = el.parentNode
  return el instanceof Element ? el.closest<HTMLElement>('[data-hl]') : null
}

const buttonClass =
  'inline-flex items-center gap-[5px] rounded-md border-0 bg-transparent px-[9px] py-[5px] font-[inherit] text-[12.5px] text-white cursor-pointer max-[879px]:min-h-11'

/** Floating pill toolbar (prototype: Reader.dc.html lines 707-713) shown on
 * text selection inside a [data-hl] block. Listens on document so it works
 * regardless of which paragraph the selection started in. */
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

  if (!toolbar) return null

  return (
    <div
      // Styled inline, so `print:hidden` (a class) cannot beat its own
      // `display: flex`. The print stylesheet hides it by this attribute
      // instead, same idiom as ZoomControls' data-zbar.
      data-seltoolbar="1"
      style={{
        position: 'fixed',
        left: toolbar.x,
        top: toolbar.top,
        transform: 'translateX(-50%)',
        zIndex: 80,
        background: 'var(--ctp-toolbg)',
        borderRadius: 9,
        padding: 4,
        display: 'flex',
        gap: 2,
        boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        animation: 'dc-floatpop .16s ease',
      }}
    >
      <button
        type="button"
        aria-label="Highlight"
        className={buttonClass}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleHighlight}
      >
        <span className="text-yellow">▮</span>Highlight
      </button>
      <span style={{ width: 1, background: 'rgba(255,255,255,.15)', margin: '4px 1px' }} />
      <button
        type="button"
        aria-label="Note"
        className={buttonClass}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleNote}
      >
        <span className="text-yellow">✎</span>Note
      </button>
      <button
        type="button"
        aria-label="Ask"
        className={buttonClass}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleAsk}
      >
        <span className="text-yellow">?</span>Ask
      </button>
      <span style={{ width: 1, background: 'rgba(255,255,255,.15)', margin: '4px 1px' }} />
      <button
        type="button"
        aria-label="Copy"
        className={buttonClass}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleCopy}
      >
        Copy
      </button>
    </div>
  )
}
