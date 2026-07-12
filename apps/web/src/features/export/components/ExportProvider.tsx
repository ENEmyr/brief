'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Payload } from '@brief/schema'
import { buildEditPrompt } from '@/features/annotations'
import { useReaderStateStore } from '@/features/reader-state'
import { copyText } from '../lib/copy'
import { downloadMarkdown as downloadMarkdownFile } from '../lib/download'
import { printDocument } from '../lib/print'
import { Toast } from './Toast'
import { ShareModal } from './ShareModal'
import { CopyFallbackModal } from './CopyFallbackModal'

const TOAST_DURATION_MS = 1600
const NO_EDIT_POINTS_MESSAGE = 'No edit points yet - highlight something or answer a decision first'

export interface ExportContextValue {
  copy: (text: string) => Promise<void>
  share: () => void
  downloadMarkdown: () => void
  /** Print / save-as-PDF, alongside downloadMarkdown because the Topbar's
   *  Download menu offers the two as items of one control (see lib/print.ts). */
  print: () => void
  /** Builds the edit prompt from the reader's current highlights/decision
   *  answers and copies it, or toasts that there is nothing to act on yet.
   *  The Edit menu's one live item (see EditMenu.tsx). */
  copyEditPrompt: () => void
  toast: (message: string) => void
}

const noop = () => {}
const ExportContext = createContext<ExportContextValue>({
  copy: async () => {},
  share: noop,
  downloadMarkdown: noop,
  print: noop,
  copyEditPrompt: noop,
  toast: noop,
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
  children,
}: {
  sessionId: string
  payload: Payload
  /** Whether the server only holds ciphertext for this session; threaded
   *  into copyEditPrompt so the edit prompt tells the human to paste the
   *  document instead of pointing an AI at a raw endpoint that would 403.
   *  Defaults to false so existing plain-session callers need no change. */
  encrypted?: boolean
  children: React.ReactNode
}) {
  const store = useReaderStateStore()
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastMessage(message)
    toastTimer.current = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
  }, [])

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
      if (result === 'copied') toast('Copied')
      else setFallbackText(text)
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
    else toast(NO_EDIT_POINTS_MESSAGE)
  }, [payload, store, sessionId, encrypted, copy, toast])

  const value = useMemo<ExportContextValue>(
    () => ({ copy, share, downloadMarkdown, print, copyEditPrompt, toast }),
    [copy, share, downloadMarkdown, print, copyEditPrompt, toast],
  )

  return (
    <ExportContext.Provider value={value}>
      {children}
      <Toast message={toastMessage} />
      {shareOpen && (
        <ShareModal
          sessionId={sessionId}
          version={payload.meta.version}
          onClose={() => setShareOpen(false)}
          onCopy={copy}
        />
      )}
      {fallbackText != null && (
        <CopyFallbackModal
          text={fallbackText}
          onClose={() => setFallbackText(null)}
          onCopied={() => toast('Copied')}
        />
      )}
    </ExportContext.Provider>
  )
}
