export type ShortcutId = 'palette' | 'nextSection' | 'prevSection' | 'help'

/** One registry row = one line of the shortcut sheet. */
export interface ShortcutRow {
  keys: readonly string[]
  description: string
}

/** `key` is lower case. With `mod`, Cmd or Ctrl must be held; without it the binding is a single-key shortcut. */
interface Binding {
  id: ShortcutId
  key: string
  mod?: true
}

const SHORTCUTS: readonly (ShortcutRow & { bindings: readonly Binding[] })[] = [
  { keys: ['mod', 'K'], description: 'command palette and search', bindings: [{ id: 'palette', key: 'k', mod: true }] },
  {
    keys: ['J', 'K'],
    description: 'next and previous section',
    bindings: [
      { id: 'nextSection', key: 'j' },
      { id: 'prevSection', key: 'k' },
    ],
  },
  { keys: ['?'], description: 'show all shortcuts', bindings: [{ id: 'help', key: '?' }] },
  // Each overlay handles Esc itself; the row is listed because it works in every one of them.
  { keys: ['Esc'], description: 'close and return focus to the trigger', bindings: [] },
]

export const SHORTCUT_ROWS: readonly ShortcutRow[] = SHORTCUTS

const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'])

/** True when a single-key shortcut must not fire: a field, an overlay or the text selection owns the letter. */
export function isSingleKeyBlocked(target: Element | null): boolean {
  if (document.querySelector('[data-seltoolbar]')) return true
  if (!target) return false
  const takesText =
    (target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type)) ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  return takesText || target.closest('[role="dialog"], [role="menu"], [role="listbox"], [data-popover]') !== null
}

/** '⌘' on Apple platforms (Mac, iPhone, iPad), 'Ctrl' elsewhere. */
export function modKeyLabel(): string {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl'
}

// A Thai (or any non-Latin) layout reports its own character in `key`, so a
// letter shortcut falls back to the physical key there.
function pressedKey(event: KeyboardEvent): string {
  const key = event.key.toLowerCase()
  return /^[\x20-\x7e]$/.test(key) || !event.code.startsWith('Key') ? key : event.code.slice(3).toLowerCase()
}

function matches(binding: Binding, event: KeyboardEvent, key: string): boolean {
  if (key !== binding.key) return false
  if (binding.mod) return (event.metaKey || event.ctrlKey) && !document.querySelector('[aria-modal="true"]')
  return (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.isComposing &&
    !event.defaultPrevented &&
    !isSingleKeyBlocked(document.activeElement)
  )
}

export function matchShortcut(event: KeyboardEvent): ShortcutId | undefined {
  // Chrome's autofill dispatches keydown events that carry no key.
  if (!event.key) return undefined
  const key = pressedKey(event)
  return SHORTCUTS.flatMap((row) => row.bindings).find((binding) => matches(binding, event, key))?.id
}
