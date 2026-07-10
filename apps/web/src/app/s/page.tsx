'use client'
import { useEffect, useState } from 'react'
import { SessionView } from '@/features/reader'

export default function SessionPage() {
  const [id, setId] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    const m = window.location.pathname.match(/^\/s\/([0-9a-zA-Z]{14})/)
    setId(m ? m[1] : null)
  }, [])
  if (id === undefined) return null
  return <SessionView id={id} />
}
