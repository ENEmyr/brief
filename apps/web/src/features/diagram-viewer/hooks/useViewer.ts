'use client'
import { useCallback, useState } from 'react'

export interface UseViewerResult {
  content: string | null
  open: (html: string) => void
  close: () => void
}

/**
 * Owns the fullscreen diagram viewer's open/closed state. `content` is the
 * serialized `outerHTML` of the diagram element being expanded (see
 * ViewerOverlay for why that's safe to inject via dangerouslySetInnerHTML).
 */
export function useViewer(): UseViewerResult {
  const [content, setContent] = useState<string | null>(null)

  const open = useCallback((html: string) => setContent(html), [])
  const close = useCallback(() => setContent(null), [])

  return { content, open, close }
}
