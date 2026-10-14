export type ShortcutId =
  | 'palette'
  | 'nextSection'
  | 'prevSection'
  | 'pickOption'
  | 'nextDecision'
  | 'copyPrompt'
  | 'help'
  | 'highlight'
  | 'note'
  | 'ask'

/** One registry row = one line of the shortcut sheet. */
export interface ShortcutRow {
  keys: readonly string[]
  description: string
}

/**
 * `key` is lower case. With `mod`, Cmd or Ctrl must be held; without it the
 * binding is a single-key shortcut. `inDock` keeps it working inside the dock's
 * own sheet under 880, which is a modal dialog like any other.
 */
interface Binding {
  id: ShortcutId
  key: string
  mod?: true
  inDock?: true
  onSelection?: true
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
  {
    keys: ['1', '9'],
    description: 'pick an option in the focused question',
    bindings: ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => ({ id: 'pickOption' as const, key, inDock: true as const })),
  },
  { keys: ['N'], description: 'jump to next unanswered question', bindings: [{ id: 'nextDecision', key: 'n', inDock: true }] },
  {
    keys: ['H', 'N', 'A'],
    description: 'highlight, note or ask on the selected text',
    bindings: [
      { id: 'highlight', key: 'h', onSelection: true },
      { id: 'note', key: 'n', onSelection: true },
      { id: 'ask', key: 'a', onSelection: true },
    ],
  },
  { keys: ['mod', 'Enter'], description: 'copy the prompt', bindings: [{ id: 'copyPrompt', key: 'enter', mod: true, inDock: true }] },
  { keys: ['?'], description: 'show all shortcuts', bindings: [{ id: 'help', key: '?' }] },
  // Each overlay handles Esc itself; the row is listed because it works in every one of them.
  { keys: ['Esc'], description: 'close and return focus to the trigger', bindings: [] },
]

export const SHORTCUT_ROWS: readonly ShortcutRow[] = SHORTCUTS

const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'])

/** True when a single-key shortcut must not fire: a field, an overlay or the text selection owns the letter. */
function isSingleKeyBlocked(target: Element | null, binding: Binding): boolean {
  const selectionShown = document.querySelector('[data-seltoolbar]') !== null
  if (selectionShown !== (binding.onSelection === true)) return true
  if (!target) return false
  const takesText =
    (target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type)) ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  const dialog = binding.inDock ? '[role="dialog"]:not([data-dock])' : '[role="dialog"]'
  return takesText || target.closest(`${dialog}, [role="menu"], [role="listbox"], [data-popover], [data-seltoolbar]`) !== null
}

/** '⌘' on Apple platforms (Mac, iPhone, iPad), 'Ctrl' elsewhere. */
export function modKeyLabel(): string {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl'
}

// A Thai (or any non-Latin) layout reports its own character in `key`, so a
// letter shortcut falls back to the physical key there. Digits always go by the
// physical key: Thai Kedmanee puts "/" and "-" on the 2 and 3 keys.
function pressedKey(event: KeyboardEvent): string {
  if (event.code.startsWith('Digit')) return event.code.slice(5)
  const key = event.key.toLowerCase()
  return /^[\x20-\x7e]$/.test(key) || !event.code.startsWith('Key') ? key : event.code.slice(3).toLowerCase()
}

function matches(binding: Binding, event: KeyboardEvent, key: string): boolean {
  if (key !== binding.key) return false
  if (binding.mod) {
    const modal = binding.inDock ? '[aria-modal="true"]:not([data-dock])' : '[aria-modal="true"]'
    return (event.metaKey || event.ctrlKey) && !document.querySelector(modal)
  }
  return (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.isComposing &&
    !event.defaultPrevented &&
    !isSingleKeyBlocked(document.activeElement, binding)
  )
}

/** The binding the event triggers; `key` tells a handler which of its keys was pressed (1 to 9). */
export function matchShortcut(event: KeyboardEvent): { id: ShortcutId; key: string } | undefined {
  // Chrome's autofill dispatches keydown events that carry no key.
  if (!event.key) return undefined
  const key = pressedKey(event)
  const binding = SHORTCUTS.flatMap((row) => row.bindings).find((b) => matches(b, event, key))
  return binding && { id: binding.id, key: binding.key }
}
