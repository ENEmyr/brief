import { useEffect, useRef } from 'react'
import { matchShortcut } from '../lib/registry'
import type { ShortcutId } from '../lib/registry'

/**
 * Binds the registry's keys on document keydown; a missing handler leaves that
 * key unbound. A handler that returns false declines the key, so another
 * component's handler for the same binding still gets it.
 */
export function useShortcuts(
  handlers: Partial<Record<ShortcutId, (key: string) => boolean | void>>,
): void {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const match = matchShortcut(event)
      const handler = match && handlersRef.current[match.id]
      if (!handler || handler(match.key) === false) return
      event.preventDefault()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
