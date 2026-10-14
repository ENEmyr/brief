import { useEffect, useRef } from 'react'
import { matchShortcut } from '../lib/registry'
import type { ShortcutId } from '../lib/registry'

/** Binds the registry's keys on document keydown; a missing handler leaves that key unbound. */
export function useShortcuts(handlers: Partial<Record<ShortcutId, () => void>>): void {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const id = matchShortcut(event)
      const handler = id && handlersRef.current[id]
      if (!handler) return
      event.preventDefault()
      handler()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
