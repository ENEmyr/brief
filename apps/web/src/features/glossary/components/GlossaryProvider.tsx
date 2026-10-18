'use client'
import type { StoredPayload } from '@brief/schema'
import { createContext, useContext, useMemo } from 'react'
import { buildGlossaryIndex, EMPTY_GLOSSARY, leafKey, type GlossaryIndex, type TermHit } from '../lib/glossaryIndex'

interface GlossaryContextValue {
  index: GlossaryIndex
  onSection: (id: string) => void
  onDecision: (id: string) => void
}

const noop = () => {}
const GlossaryContext = createContext<GlossaryContextValue>({ index: EMPTY_GLOSSARY, onSection: noop, onDecision: noop })

export function GlossaryProvider({
  payload,
  onSection,
  onDecision,
  children,
}: {
  payload: Pick<StoredPayload, 'glossary' | 'sections' | 'decisions'>
  onSection: (id: string) => void
  onDecision: (id: string) => void
  children: React.ReactNode
}) {
  const { glossary, sections, decisions } = payload
  const index = useMemo(() => buildGlossaryIndex({ glossary, sections, decisions }), [glossary, sections, decisions])
  const value = useMemo(() => ({ index, onSection, onDecision }), [index, onSection, onDecision])
  return <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>
}

export function useGlossary(): GlossaryContextValue {
  return useContext(GlossaryContext)
}

const NO_HITS: TermHit[] = []

/** The first-use term ranges to underline in one leaf. */
export function useLeafTerms(sid: number | undefined, bid: number | null, path: string): TermHit[] {
  const { index } = useGlossary()
  if (sid === undefined) return NO_HITS
  return index.leaves.get(leafKey(sid, bid, path)) ?? NO_HITS
}
