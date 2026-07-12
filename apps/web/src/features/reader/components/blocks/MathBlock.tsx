'use client'
import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { titleCaption } from '../blockAnchor'
import type { BlockAnchor } from '../blockAnchor'
// Static import at module scope is safe here only because MathBlock itself
// is loaded via next/dynamic({ ssr: false }) in BlockRenderer — the CSS
// still lands in that lazy chunk rather than the app's first-load bundle.
import 'katex/dist/katex.min.css'

type MathBlockType = Extract<Block, { type: 'math' }>

const FALLBACK_PRE_CLASS = 'm-0 overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] text-sub'

/**
 * KaTeX-rendered equation block. `katex` is imported lazily inside the
 * effect so its ~250KB never enters the first-load chunk (see BlockRenderer
 * for the next/dynamic wrapper that keeps this component itself lazy too).
 * `throwOnError: false` makes KaTeX render malformed LaTeX as inline red
 * error spans instead of throwing (acceptable per the brief); the try/catch
 * below is belt-and-suspenders for the rarer non-ParseError throw case.
 */
export function MathBlock({ block, ...anchor }: { block: MathBlockType } & BlockAnchor) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setHtml(null)
    import('katex')
      .then(({ renderToString }) => {
        if (cancelled) return
        try {
          setHtml(renderToString(block.latex, { throwOnError: false, displayMode: true, output: 'html' }))
        } catch {
          setHtml(null)
        }
      })
      .catch(() => {
        // Never leave the component stuck: an unforeseen import failure
        // just keeps showing the plain-latex fallback below.
      })
    return () => {
      cancelled = true
    }
  }, [block.latex])

  const safeHtml = html === null ? null : DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })

  return (
    <DiagramCard {...titleCaption(anchor, block.title, 'Equation')} expandable={html !== null}>
      {safeHtml ? (
        <div
          data-expand-root
          className="flex justify-center overflow-x-auto py-1 text-text"
          // safeHtml is KaTeX-generated markup from this block's own latex
          // source (never remote/user HTML), sanitized above as defense in
          // depth — same posture as CodePre's shiki sink (verified
          // empirically that USE_PROFILES:{html:true} preserves KaTeX's
          // classes/inline styles byte-for-byte; see task-6-report.md).
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      ) : (
        <pre className={FALLBACK_PRE_CLASS}>
          <code>{block.latex}</code>
        </pre>
      )}
    </DiagramCard>
  )
}
