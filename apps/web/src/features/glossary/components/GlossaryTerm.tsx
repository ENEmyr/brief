'use client'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGlossary } from './GlossaryProvider'

const pad = (n: number) => String(n).padStart(2, '0')

// B-NewBlocks .b-tip: 300 wide, 8px below the term, opacity .12s ease.
const TIP_WIDTH = 300
const TIP_GAP = 8
const GUTTER = 16
// Time for a pointer to cross the 8px gap into the popover before it closes.
const LEAVE_DELAY = 150
// Under 880 every control is a 44px touch target (settled rule, STATUS.md).
const REF_CLASS =
  'cursor-pointer hover:text-text max-[880px]:inline-flex max-[880px]:min-h-[44px] max-[880px]:min-w-[44px] max-[880px]:items-center max-[880px]:justify-center'

/**
 * A defined term (B-NewBlocks glossary). The wrapper holds only the term's own
 * characters and the popover renders in a portal, so the [data-hl] leaf around
 * it keeps exactly its source text: highlight offsets, notes and copy are
 * unchanged. It is a span with role button rather than a <button>, because
 * Chromium does not let a drag selection start inside a button's text.
 */
export function GlossaryTerm({ n, children }: { n: number; children: React.ReactNode }) {
  const { index, onSection, onDecision } = useGlossary()
  const term = index.terms[n - 1]
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const termRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const leaveTimer = useRef<number | undefined>(undefined)
  // Focus handed back on close must not reopen the popover.
  const refocusing = useRef(false)
  // A press already opens it through hover or focus, so a click toggles only
  // on touch, from the state the tap started in.
  const press = useRef<{ touch: boolean; wasOpen: boolean }>({ touch: false, wasOpen: false })
  const tipId = useId()

  const cancelLeave = () => window.clearTimeout(leaveTimer.current)
  const show = () => {
    cancelLeave()
    setOpen(true)
  }
  const hideSoon = () => {
    cancelLeave()
    leaveTimer.current = window.setTimeout(() => setOpen(false), LEAVE_DELAY)
  }
  const close = useCallback((refocus: boolean) => {
    window.clearTimeout(leaveTimer.current)
    setOpen(false)
    if (!refocus) return
    refocusing.current = true
    termRef.current?.focus()
    refocusing.current = false
  }, [])

  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

  useLayoutEffect(() => {
    if (!open || !termRef.current) return
    const place = () => {
      const r = termRef.current!.getBoundingClientRect()
      const width = Math.min(TIP_WIDTH, window.innerWidth - 2 * GUTTER)
      const left = Math.max(GUTTER, Math.min(r.left, window.innerWidth - GUTTER - width))
      setPos({ left, top: r.bottom + TIP_GAP })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!termRef.current?.contains(t) && !tipRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  if (!term) return <>{children}</>

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((o) => !o)
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      close(false)
    } else if (e.key === 'Tab' && !e.shiftKey && open) {
      const first = tipRef.current?.querySelector<HTMLElement>('button')
      if (first) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const onTipKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close(true)
      return
    }
    if (e.key !== 'Tab') return
    const links = [...(tipRef.current?.querySelectorAll<HTMLElement>('button') ?? [])]
    const at = links.indexOf(document.activeElement as HTMLElement)
    const leaving = e.shiftKey ? at <= 0 : at === links.length - 1
    if (leaving) {
      e.preventDefault()
      close(true)
    }
  }

  const go = (fn: () => void) => () => {
    close(false)
    fn()
  }

  return (
    <>
      <span
        ref={termRef}
        role="button"
        tabIndex={0}
        data-term={term.n}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? tipId : undefined}
        aria-describedby={open ? tipId : undefined}
        className="cursor-help border-b border-dashed border-info print:border-0"
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={() => {
          if (!refocusing.current) show()
        }}
        onBlur={(e) => {
          if (!tipRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
        }}
        onPointerDown={(e) => {
          press.current = { touch: e.pointerType === 'touch', wasOpen: open }
        }}
        onClick={() => {
          cancelLeave()
          setOpen(press.current.touch ? !press.current.wasOpen : true)
        }}
        onKeyDown={onKeyDown}
      >
        {children}
      </span>
      {open &&
        pos &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            // A tooltip may hold no controls; this one holds the section and decision links.
            role="dialog"
            aria-label={term.term}
            data-glossary-tip={term.n}
            onMouseEnter={cancelLeave}
            onMouseLeave={hideSoon}
            onKeyDown={onTipKeyDown}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null
              if (!tipRef.current?.contains(next) && next !== termRef.current) setOpen(false)
            }}
            style={{ left: pos.left, top: pos.top, width: Math.min(TIP_WIDTH, window.innerWidth - 2 * GUTTER) }}
            className="fixed z-50 flex flex-col gap-[6px] rounded-[6px] border border-line2 bg-elev p-3 text-left text-[13px] leading-5 text-text shadow-[var(--shadow-overlay)] print:hidden"
          >
            <span className="flex justify-between gap-2 font-mono text-[11px] text-info">
              <span>{term.term}</span>
              <span className="flex flex-wrap justify-end gap-[6px] text-faint">
                {term.sections.map((s) => (
                  <button key={s.id} type="button" className={REF_CLASS} onClick={go(() => onSection(s.id))}>
                    §{pad(s.no)}
                  </button>
                ))}
                {term.decisions.map((id) => (
                  <button key={id} type="button" className={REF_CLASS} onClick={go(() => onDecision(id))}>
                    {id}
                  </button>
                ))}
              </span>
            </span>
            <span>{term.def}</span>
          </div>,
          document.body,
        )}
    </>
  )
}
