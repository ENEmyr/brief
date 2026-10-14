'use client'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { Decision } from '@brief/schema'
import { useDialogFocus } from '@/features/export'
import { useReaderState } from '@/features/reader-state'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { ChevronIcon } from './icons'
import { TOUCH_BUTTON } from './topbarChrome'

function isAnswered(decision: Decision, dsel: Record<string, string[]>): boolean {
  return (dsel[decision.id]?.length ?? 0) > 0
}

/** One segment per decision: answered accent, the first open one warn, the rest line. */
function DecisionSegments({ decisions, dsel }: { decisions: Decision[]; dsel: Record<string, string[]> }) {
  const firstOpen = decisions.findIndex((d) => !isAnswered(d, dsel))
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {decisions.map((d, i) => {
        let tone = 'bg-line'
        if (isAnswered(d, dsel)) tone = 'bg-accent'
        else if (i === firstOpen) tone = 'bg-[var(--c-warn-fill)]'
        return <span key={d.id} className={`h-1 flex-1 rounded-[2px] ${tone}`} />
      })}
    </div>
  )
}

function SheetFocus({ panelRef, onClose }: { panelRef: RefObject<HTMLElement | null>; onClose: () => void }) {
  useDialogFocus(panelRef, onClose)
  return null
}

const HANDLE = 'h-1 w-9 shrink-0 self-center rounded-[2px] bg-line2'

/**
 * The decision dock's place in the layout. 1101 and up: a 340 column, sticky
 * at 64. 880 to 1100: under the document at full width. Under 880 (B-Mobile):
 * a peek bar at the bottom that opens as a bottom sheet. Phase 3 builds the
 * dock's content; until then it holds whatever it is given.
 */
export function DockSlot({
  decisions,
  open,
  onOpenChange,
  children,
}: {
  decisions: Decision[]
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  const narrow = useIsNarrow()
  const { dsel } = useReaderState()
  const asideRef = useRef<HTMLElement>(null)
  const sheet = narrow && open

  // The sheet only exists under 880; widening the window closes it.
  useEffect(() => {
    if (!narrow && open) onOpenChange(false)
  }, [narrow, open, onOpenChange])

  const total = decisions.length
  const answered = decisions.filter((d) => isAnswered(d, dsel)).length
  const next = decisions.find((d) => !isAnswered(d, dsel))
  const close = () => onOpenChange(false)

  return (
    <>
      {sheet && (
        <div
          role="presentation"
          onClick={close}
          className="console-fade fixed inset-0 z-[60] bg-[var(--c-scrim)] min-[880px]:hidden"
        />
      )}
      <aside
        ref={asideRef}
        id="dock"
        aria-label="Decision dock"
        role={sheet ? 'dialog' : undefined}
        aria-modal={sheet ? true : undefined}
        tabIndex={sheet ? -1 : undefined}
        data-dock=""
        className={`box-content flex min-w-0 flex-[0_0_340px] flex-col rounded-[6px] border border-line bg-card scroll-mt-[72px] outline-none min-[1101px]:sticky min-[1101px]:top-16 max-[1101px]:flex-[1_1_100%] max-[880px]:fixed max-[880px]:inset-x-0 max-[880px]:bottom-0 max-[880px]:box-border max-[880px]:rounded-b-none max-[880px]:border-x-0 max-[880px]:border-b-0 max-[880px]:border-t-line2 ${
          sheet
            ? 'console-sheet max-[880px]:top-[106px] max-[880px]:z-[60] max-[880px]:rounded-t-[16px]'
            : 'max-[880px]:z-40 max-[880px]:rounded-t-[14px]'
        }`}
      >
        {narrow && (
          <div
            data-dock-chrome=""
            className={`flex flex-col gap-[10px] px-3 pb-[30px] pt-2 leading-[normal] min-[880px]:hidden ${sheet ? 'hidden' : ''}`}
          >
            <span aria-hidden="true" className={HANDLE} />
            <div className="flex items-center gap-[10px]">
              <div className="flex min-w-0 grow flex-col gap-[6px]">
                <span className="text-[14px] font-semibold">
                  {answered} of {total}
                  {next && `, next ${next.id}`}
                </span>
                <DecisionSegments decisions={decisions} dsel={dsel} />
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(true)}
                className="min-h-11 shrink-0 rounded-[4px] border-0 bg-accent px-[14px] text-[14px] font-semibold text-on-accent transition-transform duration-[var(--dur-fast)] active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line motion-reduce:transition-none"
              >
                Open dock
              </button>
            </div>
          </div>
        )}
        {sheet && (
          <>
            <SheetFocus panelRef={asideRef} onClose={close} />
            <div data-dock-chrome="" className="flex flex-col leading-[normal]">
              <span aria-hidden="true" className={`${HANDLE} mt-2`} />
              <div className="flex items-center gap-2 border-b border-line py-[10px] pl-[14px] pr-[6px]">
                <span className="grow font-mono text-[11px] text-faint">
                  DECISIONS / {answered}/{total}
                </span>
                <button type="button" onClick={close} aria-label="Close dock" className={TOUCH_BUTTON}>
                  <ChevronIcon direction="down" />
                </button>
              </div>
            </div>
          </>
        )}
        <div
          data-dock-body=""
          className={sheet ? 'min-h-0 grow overflow-y-auto px-[14px] pb-[14px] pt-[6px]' : 'p-[14px] max-[880px]:hidden'}
        >
          {children}
        </div>
      </aside>
    </>
  )
}
