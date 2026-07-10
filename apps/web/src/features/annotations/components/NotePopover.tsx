'use client'
import { useReaderActions, useReaderState } from '@/features/reader-state'
import { useEscapeKey } from '../hooks/useEscapeKey'

const QUOTE_MAX = 60

/** Note popover (prototype: Reader.dc.html lines 714-723), fixed bottom-right
 * over the reader. Reads the highlight straight from the store by id so it
 * always reflects the latest note text and renders nothing once the
 * highlight is gone (removed here or elsewhere). Non-modal: Escape and the
 * "Done" button both close it, no focus trap. */
export function NotePopover({ id, onClose }: { id: string; onClose: () => void }) {
  const { highlights } = useReaderState()
  const actions = useReaderActions()
  useEscapeKey(onClose)

  const h = highlights.find((x) => x.id === id)
  if (!h) return null

  const quote = h.text.length > QUOTE_MAX ? `${h.text.slice(0, QUOTE_MAX)}…` : h.text

  function handleRemove() {
    actions.removeHighlight(id)
    onClose()
  }

  return (
    <div
      style={{ animation: 'dc-pop .18s ease' }}
      className="fixed right-6 bottom-6 z-[80] w-[300px] rounded-xl border border-line bg-card p-3.5 shadow-[var(--shadow-card)]"
    >
      <div className="mb-2 border-l-2 border-mauve pl-2 text-xs italic text-faint">“{quote}”</div>
      <textarea
        autoFocus
        value={h.note ?? ''}
        placeholder="Write a short note…"
        onChange={(ev) => actions.updateHighlight(id, { note: ev.target.value })}
        className="min-h-[70px] w-full resize-y rounded-lg border border-line bg-elev px-[10px] py-2 font-[inherit] text-[13px] text-text"
      />
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={handleRemove}
          className="max-[879px]:min-h-11 cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 font-[inherit] text-[12.5px] text-red"
        >
          Remove highlight
        </button>
        <button
          type="button"
          onClick={onClose}
          className="max-[879px]:min-h-11 cursor-pointer rounded-[7px] border-0 bg-mauve px-3.5 py-1.5 font-[inherit] text-[12.5px] font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  )
}
