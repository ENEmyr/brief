'use client'
import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { highlight } from '../../services/shiki'

export interface CodePreProps {
  code: string
  language: string
  highlightLines?: number[]
}

const PRE_CLASS = 'm-0 overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7]'
// Shiki's own <pre> arrives unstyled beyond its inline background/color, so
// these Tailwind arbitrary-variant rules target it as a direct child rather
// than relying on any class shiki itself adds.
const HIGHLIGHTED_WRAPPER_CLASS =
  '[&>pre]:m-0 [&>pre]:overflow-x-auto [&>pre]:p-4 [&>pre]:font-mono [&>pre]:text-[12.5px] [&>pre]:leading-[1.7]'

/**
 * Shared code-panel body used by CodeBlock and BeforeAfter: renders a plain,
 * uncolored `<pre><code>` immediately (so the code is never blocked on the
 * lazy shiki import), then swaps in shiki-highlighted markup once `highlight`
 * resolves. Both states share the same dark panel look (`--code-bg` / fixed
 * `#cdd6f4` text) per the prototype, which keeps a dark code panel in both
 * app themes — see globals.css.
 */
export function CodePre({ code, language, highlightLines }: CodePreProps) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setHtml(null)
    highlight(code, language, { highlightLines })
      .then((result) => {
        if (!cancelled) setHtml(result)
      })
      .catch(() => {
        // highlight() itself already falls back to plaintext internally and
        // should not reject; this guard just guarantees a rejected mock (or
        // an unforeseen failure) never leaves the component stuck rendering
        // the plain fallback forever without throwing.
      })
    return () => {
      cancelled = true
    }
  }, [code, language, highlightLines])

  const safeHtml = html === null ? null : DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })

  if (safeHtml) {
    return (
      <div
        className={HIGHLIGHTED_WRAPPER_CLASS}
        // safeHtml is shiki-generated markup from this block's own code text
        // (never remote/user HTML), sanitized above as defense in depth —
        // same posture as ViewerOverlay's diagram HTML sink. The semgrep
        // rule is pattern-based and can't see that DOMPurify already ran.
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    )
  }

  return (
    <pre className={PRE_CLASS} style={{ background: 'var(--code-bg)', color: '#cdd6f4' }}>
      <code>{code}</code>
    </pre>
  )
}
