import type { Decision, Payload, StoredBlock, StoredPayload } from '@brief/schema'
import { parseInline } from '@/features/annotations'

/** One glossary entry as the reader shows it. `n` is its print number: its
 * place in the payload's glossary array, from 1 (B-Print numbers p95 "2" though
 * it is read before "1"). */
export interface GlossaryTerm {
  n: number
  term: string
  def: string
  /** Sections whose prose uses the term, in document order. */
  sections: { id: string; no: number }[]
  /** Ids of decisions whose question, options or why use the term. */
  decisions: string[]
}

/** A term match inside one leaf string, in source offsets (markers counted). */
export interface TermHit {
  start: number
  end: number
  n: number
}

export interface GlossaryIndex {
  terms: GlossaryTerm[]
  /** First use of each term per section, keyed by leafKey. */
  leaves: Map<string, TermHit[]>
}

export const EMPTY_GLOSSARY: GlossaryIndex = { terms: [], leaves: new Map() }

export function leafKey(sid: number, bid: number | null, path: string): string {
  return `${sid}|${bid ?? ''}|${path}`
}

interface Needle {
  text: string
  n: number
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}_]/u
// Scripts written without spaces between words: a letter there is no word edge.
const UNSPACED = /[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && LETTER_OR_DIGIT.test(c) && !UNSPACED.test(c)
}

/**
 * Matching rules, in order:
 * 1. A term and each of its aliases is a needle; case-insensitive (toLowerCase).
 * 2. Whole words: a match may not continue a word on either side. Letters of
 *    scripts written without spaces (Thai, Lao, Khmer, Myanmar, Han, kana) never
 *    count as a word edge, so "token" matches in "ใช้token".
 * 3. Leftmost first, then longest needle first; matches never overlap.
 * 4. Only visible prose: never inside a `code` run, never across a run edge.
 */
export function compileNeedles(glossary: Payload['glossary']): Needle[] {
  const seen = new Set<string>()
  const needles: Needle[] = []
  ;(glossary ?? []).forEach((entry, i) => {
    for (const raw of [entry.term, ...(entry.aliases ?? [])]) {
      const text = raw.trim().toLowerCase()
      if (!text || seen.has(text)) continue
      seen.add(text)
      needles.push({ text, n: i + 1 })
    }
  })
  return needles.sort((a, b) => b.text.length - a.text.length)
}

function matchAt(src: string, lower: string, i: number, end: number, needles: Needle[]): TermHit | null {
  for (const needle of needles) {
    const stop = i + needle.text.length
    if (stop > end || !lower.startsWith(needle.text, i)) continue
    const startsWord = isWordChar(src[i - 1]) && isWordChar(src[i])
    const endsWord = isWordChar(src[stop - 1]) && isWordChar(src[stop])
    if (!startsWord && !endsWord) return { start: i, end: stop, n: needle.n }
  }
  return null
}

/** Every term match in a leaf's source string, per the rules above. */
export function findTermHits(src: string, needles: Needle[]): TermHit[] {
  if (needles.length === 0) return []
  // Lowercasing must keep offsets: skip the rare strings where it changes length.
  const lower = src.toLowerCase()
  if (lower.length !== src.length) return []
  const hits: TermHit[] = []
  for (const run of parseInline(src)) {
    if (run.kind === 'code') continue
    const end = run.end - run.marker
    let i = run.start + run.marker
    while (i < end) {
      const hit = matchAt(src, lower, i, end, needles)
      if (hit) {
        hits.push(hit)
        i = hit.end
      } else i++
    }
  }
  return hits
}

/** The prose leaves of one block in render order, as [bid-relative path, text]. */
function proseLeaves(block: StoredBlock, prefix = ''): [string, string][] {
  switch (block.type) {
    case 'p':
      return [[`${prefix}text`, block.text]]
    case 'note':
    case 'warn':
    case 'good':
      return [
        ...(block.title ? ([[`${prefix}title`, block.title]] as [string, string][]) : []),
        [`${prefix}text`, block.text],
      ]
    case 'table':
      return [
        ...block.head.map((cell, i): [string, string] => [`${prefix}head.${i}`, cell]),
        ...block.rows.flatMap((row, i) => row.map((cell, j): [string, string] => [`${prefix}rows.${i}.${j}`, cell])),
      ]
    case 'stat':
      return block.items.map((item, i): [string, string] => [`${prefix}items.${i}.label`, item.label])
    case 'details':
      return block.blocks.flatMap((b, i) => proseLeaves(b, `${prefix}blocks.${i}.`))
    default:
      return []
  }
}

function decisionText(d: Decision): string {
  return [d.q, ...d.opts.flatMap((o) => [o.label, o.detail ?? '']), d.why ?? ''].join('\n')
}

export function buildGlossaryIndex(payload: Pick<StoredPayload, 'glossary' | 'sections' | 'decisions'>): GlossaryIndex {
  const needles = compileNeedles(payload.glossary)
  if (needles.length === 0) return EMPTY_GLOSSARY
  const terms: GlossaryTerm[] = (payload.glossary ?? []).map((g, i) => ({
    n: i + 1,
    term: g.term,
    def: g.def,
    sections: [],
    decisions: [],
  }))
  const leaves = new Map<string, TermHit[]>()

  payload.sections.forEach((section, sid) => {
    const used = new Set<number>()
    section.blocks.forEach((block, bid) => {
      for (const [path, text] of proseLeaves(block)) {
        const first = findTermHits(text, needles).filter((h) => !used.has(h.n))
        if (first.length === 0) continue
        const kept: TermHit[] = []
        for (const hit of first) {
          if (used.has(hit.n)) continue
          used.add(hit.n)
          kept.push(hit)
        }
        leaves.set(leafKey(sid, bid, path), kept)
      }
    })
    for (const n of used) terms[n - 1]?.sections.push({ id: section.id, no: section.no })
  })

  for (const d of payload.decisions) {
    const used = new Set(findTermHits(decisionText(d), needles).map((h) => h.n))
    for (const n of used) terms[n - 1]?.decisions.push(d.id)
  }

  return { terms, leaves }
}
