'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { Payload } from '@brief/schema'
import { useReaderState } from '@/features/reader-state'
import { copyText } from '../lib/copy'
import { downloadMarkdown as downloadMarkdownFile } from '../lib/download'
import { Toast } from './Toast'
import { ShareModal } from './ShareModal'
import { CopyFallbackModal } from './CopyFallbackModal'

const TOAST_DURATION_MS = 1600

export interface ExportContextValue {
  copy: (text: string) => Promise<void>
  share: () => void
  downloadMarkdown: () => void
  toast: (message: string) => void
}

const noop = () => {}
const ExportContext = createContext<ExportContextValue>({
  copy: async () => {},
  share: noop,
  downloadMarkdown: noop,
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
 * and decision answers via useReaderState() to build the export markdown at
 * download time, always current with no prop-drilled state.
 */
export function ExportProvider({
  sessionId,
  payload,
  children,
}: {
  sessionId: string
  payload: Payload
  children: React.ReactNode
}) {
  const state = useReaderState()
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastMessage(message)
    toastTimer.current = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
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
    downloadMarkdownFile(payload, state, sessionId, window.location.origin)
  }, [payload, state, sessionId])

  const value: ExportContextValue = { copy, share, downloadMarkdown, toast }

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
        <CopyFallbackModal text={fallbackText} onClose={() => setFallbackText(null)} />
      )}
    </ExportContext.Provider>
  )
}
