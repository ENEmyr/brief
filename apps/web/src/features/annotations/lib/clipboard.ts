/** Copies text via the async Clipboard API when available, falling back to
 * a hidden-textarea execCommand('copy') otherwise. Shared by SelectionToolbar
 * and AskPopover as their default `copyText` prop — kept minimal per the
 * Task 2 brief; the real copy chain (with feedback toast, etc.) lands in
 * Task 6. */
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
