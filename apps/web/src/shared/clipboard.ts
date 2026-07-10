// Copies text via the async Clipboard API when available, falling back to a
// hidden-textarea execCommand('copy') otherwise. Extracted from the
// annotations feature (Task 2) so the decisions feature's PromptReview can
// reuse the same default `copyText` prop convention without a disallowed
// cross-feature deep import -- same "small helper multiple features need"
// precedent as shared/api.ts (Task 1).
export function defaultCopyText(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => execCommandCopy(text))
    return
  }
  execCommandCopy(text)
}

/**
 * Richer copy chain (Task 6, prototype Reader.dc.html lines 299-324's
 * execCopy/copy): tries the synchronous execCommand('copy') textarea trick
 * FIRST (most reliable inside a click gesture, works even when the async
 * Clipboard API is blocked by a permissions policy), then falls back to the
 * async Clipboard API, and only resolves 'fallback' when both fail so the
 * caller (export feature's ExportProvider) can open a manual-copy modal.
 * This is the single source for the copy chain -- the export feature's
 * lib/copy.ts re-exports it rather than reimplementing, same "small shared
 * helper" precedent as defaultCopyText above.
 */
export async function copyText(text: string): Promise<'copied' | 'fallback'> {
  if (execCommandCopy(text)) return 'copied'
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return 'copied'
    } catch {
      return 'fallback'
    }
  }
  return 'fallback'
}

/**
 * Synchronous execCommand('copy') via a temporary off-screen textarea.
 * Restores whatever had focus beforehand (prototype's `prev.focus()`) so the
 * copy action doesn't steal focus from the triggering control. Returns
 * whether the browser reported the copy as successful. Exported for the
 * export feature's CopyFallbackModal "Try copy again" button, which per the
 * prototype (Reader.dc.html line 335) re-runs ONLY this synchronous path --
 * the modal only ever opens after the async Clipboard API already failed,
 * so retrying it would just re-fail asynchronously.
 */
export function execCommandCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  const previouslyFocused = document.activeElement as HTMLElement | null
  textarea.focus()
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  previouslyFocused?.focus()
  return ok
}
