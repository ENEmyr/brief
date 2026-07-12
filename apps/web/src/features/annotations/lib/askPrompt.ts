import type { Section } from '@brief/schema'
import { DEFAULT_HIGHLIGHT_PATH } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'

/** Zero-pads a section number, shared with editPrompt.ts so both prompt
 *  builders render section references identically. */
export const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Where inside the section a highlight sits. "paragraph N" no longer covers it:
 * a highlight can now anchor to the section heading (which is not a block) or to
 * a leaf inside a structured block, so the leaf path carries the detail that
 * actually locates the quote (`rows.3.1` in a table, say).
 */
export function describeLocation(h: Highlight): string {
  if (h.bid === null) return 'heading'
  const path = h.path ?? DEFAULT_HIGHLIGHT_PATH
  const block = `block ${h.bid + 1}`
  return path === DEFAULT_HIGHLIGHT_PATH ? block : `${block} (${path})`
}

/** Builds the "Copy as prompt" text for an ask highlight, adapted from the
 * prototype's buildAskPrompt (Reader.dc.html lines 208-221): origin and
 * sessionId are passed in instead of the prototype's hardcoded shareUrl(),
 * a docTitle param replaces the prototype's fixed "Rate Limiter" string, and
 * the section number is zero-padded to match how every other UI surface in
 * this app renders it (SectionView/Toc) -- the prototype itself left this
 * one spot unpadded. When the highlight's section can no longer be found
 * (deleted/reordered), falls back to the raw sid and drops the URL's
 * fragment, mirroring the prototype's own fallback. */
export function buildAskPrompt(
  h: Highlight,
  sections: Section[],
  sessionId: string,
  origin: string,
  docTitle: string,
): string {
  const section = sections[h.sid]
  const locationSection = section ? `section ${pad(section.no)} "${section.title}"` : `section ${h.sid}`
  const url = `${origin}/s/${sessionId}${section ? `#${section.id}` : ''}`
  const question = (h.question ?? '').trim() || '(add your question)'

  return [
    `Question about a specific part of the "${docTitle}" doc (session ${sessionId}).`,
    '',
    'Reference:',
    `- URL: ${url}`,
    `- Location: ${locationSection} · ${describeLocation(h)} · chars ${h.start}–${h.end}`,
    `- Quoted text: "${h.text}"`,
    '',
    'Question:',
    question,
    '',
    'Please answer specifically about the quoted part above, using the reference to locate it.',
  ].join('\n')
}
