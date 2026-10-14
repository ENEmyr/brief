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
      data-popover=""
      className="console-pop fixed right-6 bottom-6 z-[80] w-[300px] rounded-overlay border border-line2 bg-card p-3.5 shadow-[var(--shadow-overlay)]"
    >
      <div className="mb-2 border-l-2 border-accent-line pl-2 text-xs italic text-faint">“{quote}”</div>
      <textarea
        autoFocus
        value={h.note ?? ''}
        placeholder="Write a short note…"
        onChange={(ev) => actions.updateHighlight(id, { note: ev.target.value })}
        className="min-h-[70px] w-full resize-y rounded-ctrl border border-line2 bg-page px-[10px] py-2 font-[inherit] text-[16px] leading-6 text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
      />
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={handleRemove}
          className="max-[880px]:min-h-11 min-h-8 cursor-pointer rounded-ctrl border-0 bg-transparent px-2 font-[inherit] text-[13px] text-bad focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
        >
          Remove highlight
        </button>
        <button
          type="button"
          onClick={onClose}
          className="max-[880px]:min-h-11 min-h-8 cursor-pointer rounded-ctrl border-0 bg-accent px-3.5 font-[inherit] text-[13px] font-semibold text-on-accent transition-transform duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
        >
          Done
        </button>
      </div>
    </div>
  )
}
