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

function execCommandCopy(text: string): void {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
  } catch {
    // clipboard unavailable in this environment: silently no-op
  }
  document.body.removeChild(textarea)
}
