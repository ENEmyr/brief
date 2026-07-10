'use client'
import { useEffect, useState } from 'react'
import { fetchSession, SessionNotFoundError, type SessionData } from '../services/api'

export type SessionStatus = 'loading' | 'ready' | 'notfound' | 'error'

export function useSession(id: string | null): { status: SessionStatus; data?: SessionData } {
  const [state, setState] = useState<{ status: SessionStatus; data?: SessionData }>({
    status: 'loading',
  })

  useEffect(() => {
    if (!id) {
      setState({ status: 'notfound' })
      return
    }
    let cancelled = false
    fetchSession(id)
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch((err) =>
        !cancelled &&
        setState({ status: err instanceof SessionNotFoundError ? 'notfound' : 'error' }),
      )
    return () => {
      cancelled = true
    }
  }, [id])

  return state
}
