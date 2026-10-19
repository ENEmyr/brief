'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { StoredPayload } from '@brief/schema'
import { buildEditPrompt } from '@/features/annotations'
import { useReaderStateStore } from '@/features/reader-state'
import { PrintTerms } from '@/features/glossary'
import { copyText } from '../lib/copy'
import { downloadMarkdown as downloadMarkdownFile } from '../lib/download'
import { printDocument } from '../lib/print'
import { usePrintSnapshot } from '../hooks/usePrintSnapshot'
import { PrintAnswers, PrintHeader } from './PrintSheet'
import { OverlayExit } from '@/shared/OverlayExit'
import { Toast, isSticky } from './Toast'
import type { ShownToast, ToastSpec } from './Toast'
import { ShareModal } from './ShareModal'
import { CopyFallbackModal } from './CopyFallbackModal'

const TOAST_DURATION_MS = 1600
const COPIED: ToastSpec = { kind: 'done', message: 'Copied' }
const NO_EDIT_POINTS: ToastSpec = {
  kind: 'info',
  message: 'No edit points yet - highlight something or answer a decision first',
}

export interface ExportContextValue {
  /** Resolves 'copied', or 'fallback' once the manual-copy dialog opened instead. */
  copy: (text: string) => Promise<'copied' | 'fallback'>
  share: () => void
  downloadMarkdown: () => void
  /** Print / save-as-PDF, alongside downloadMarkdown because the Topbar's
   *  Download menu offers the two as items of one control (see lib/print.ts). */
  print: () => void
  /** Builds the edit prompt from the reader's current highlights/decision
   *  answers and copies it, or toasts that there is nothing to act on yet.
   *  The Edit menu's one live item (see EditMenu.tsx). */
  copyEditPrompt: () => void
  /** Shows one toast, replacing any other; returns its id for dismissToast. */
  toast: (toast: ToastSpec) => number
  /** Hides the toast with this id, if it is still the one showing. */
  dismissToast: (id: number) => void
}

const noop = () => {}
const ExportContext = createContext<ExportContextValue>({
  copy: async () => 'fallback',
  share: noop,
  downloadMarkdown: noop,
  print: noop,
  copyEditPrompt: noop,
  toast: () => 0,
  dismissToast: noop,
})

/**
 * useExport() outside a provider degrades to a harmless no-op context, same
 * "consumers never need to wrap in a provider just to render" posture as
 * useDiagramViewer's context default.
 */
export function useExport(): ExportContextValue {
  return useContext(ExportContext)
}

/**
 * Owns every export-related side effect for one reader session: the copy
 * chain's toast/fallback-modal outcome, the share dialog, and the markdown
 * download. Must render inside ReaderStateProvider -- it reads highlights
 * and decision answers via a store handle (useReaderStateStore) to build
 * the export markdown at download time, always current with no prop-drilled
 * state. Deliberately does NOT subscribe to the store during render
 * (useReaderState()) -- that would re-render this provider, and everything
 * that reads its (memoized) context value, on every highlight/decision
 * mutation in the whole reader even though downloadMarkdown only needs the
 * state at the moment it is actually invoked.
 */
export function ExportProvider({
  sessionId,
  payload,
  encrypted = false,
  expiresAt,
  children,
}: {
  sessionId: string
  payload: StoredPayload
  /** When the session expires (epoch ms, from the session GET). */
  expiresAt?: number
  /** Whether the server only holds ciphertext for this session; threaded
   *  into copyEditPrompt so the edit prompt tells the human to paste the
   *  document instead of pointing an AI at a raw endpoint that would 403.
   *  Defaults to false so existing plain-session callers need no change. */
  encrypted?: boolean
  children: React.ReactNode
}) {
  const store = useReaderStateStore()
  const [shown, setShown] = useState<ShownToast | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastToastId = useRef(0)
  const printSnapshot = usePrintSnapshot(store, sessionId)

  const dismissToast = useCallback((id: number) => {
    setShown((current) => (current?.id === id ? null : current))
  }, [])

  const toast = useCallback(
    (spec: ToastSpec) => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      const id = ++lastToastId.current
      setShown({ id, spec })
      if (!isSticky(spec)) toastTimer.current = setTimeout(() => dismissToast(id), TOAST_DURATION_MS)
      return id
    },
    [dismissToast],
  )

  // Clear any pending auto-dismiss timer on unmount, so it can never fire a
  // setState against an unmounted provider (review finding).
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string) => {
      const result = await copyText(text)
      if (result === 'copied') toast(COPIED)
      else setFallbackText(text)
      return result
    },
    [toast],
  )

  const share = useCallback(() => setShareOpen(true), [])

  const downloadMarkdown = useCallback(() => {
    downloadMarkdownFile(payload, store.getState(), sessionId, window.location.origin)
  }, [payload, store, sessionId])

  const print = useCallback(() => printDocument(), [])

  const copyEditPrompt = useCallback(() => {
    const prompt = buildEditPrompt(payload, store.getState(), sessionId, window.location.origin, encrypted)
    if (prompt) void copy(prompt)
    else toast(NO_EDIT_POINTS)
  }, [payload, store, sessionId, encrypted, copy, toast])

  const value = useMemo<ExportContextValue>(
    () => ({ copy, share, downloadMarkdown, print, copyEditPrompt, toast, dismissToast }),
    [copy, share, downloadMarkdown, print, copyEditPrompt, toast, dismissToast],
  )

  return (
    <ExportContext.Provider value={value}>
      {printSnapshot && <PrintHeader payload={payload} sessionId={sessionId} snapshot={printSnapshot} />}
      {children}
      {printSnapshot && <PrintAnswers decisions={payload.decisions} state={printSnapshot.state} />}
      <PrintTerms glossary={payload.glossary} />
      <Toast toast={shown} onDismiss={() => shown && dismissToast(shown.id)} />
      <OverlayExit open={shareOpen}>
        {shareOpen && (
          <ShareModal
            sessionId={sessionId}
            version={payload.meta.version}
            expiresAt={expiresAt}
            onClose={() => setShareOpen(false)}
            onCopy={copy}
          />
        )}
      </OverlayExit>
      <OverlayExit open={fallbackText != null}>
        {fallbackText != null && (
          <CopyFallbackModal
            text={fallbackText}
            onClose={() => setFallbackText(null)}
            onCopied={() => toast(COPIED)}
          />
        )}
      </OverlayExit>
    </ExportContext.Provider>
  )
}
