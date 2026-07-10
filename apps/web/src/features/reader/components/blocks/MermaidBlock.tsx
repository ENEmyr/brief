'use client'
import { useEffect, useId, useState } from 'react'
import DOMPurify from 'dompurify'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { useTheme } from '@/features/theme'

type MermaidBlockType = Extract<Block, { type: 'mermaid' }>

// Literal Catppuccin hex values (not getComputedStyle — mermaid renders into
// its own detached temp DOM node before we ever see the resulting markup, so
// CSS custom properties on the document wouldn't be visible to it anyway).
const THEME_VARIABLES = {
  latte: {
    background: '#ffffff',
    primaryColor: '#f2ebfd',
    primaryTextColor: '#4c4f69',
    primaryBorderColor: '#8839ef',
    lineColor: '#6c6f85',
    fontFamily: 'IBM Plex Mono',
  },
  mocha: {
    background: '#1e1e2e',
    primaryColor: 'rgba(203, 166, 247, .14)',
    primaryTextColor: '#cdd6f4',
    primaryBorderColor: '#cba6f7',
    lineColor: '#a6adc8',
    fontFamily: 'IBM Plex Mono',
  },
} as const

const FALLBACK_PRE_CLASS = 'm-0 overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] text-sub'

// useId() returns something like ":r0:" — strip everything but
// alphanumerics/hyphens so the result is a valid CSS id for mermaid.render.
function cssId(id: string): string {
  return `mm-${id.replace(/[^a-zA-Z0-9-]/g, '')}`
}

/**
 * Mermaid-rendered diagram block. `mermaid` is imported lazily inside the
 * effect (never enters the first-load chunk). Re-initializes and re-renders
 * whenever the app theme flips, using a literal per-palette themeVariables
 * map (see THEME_VARIABLES above) rather than reading CSS custom properties.
 *
 * `securityLevel: 'strict'` + `flowchart: { htmlLabels: false }` keeps
 * mermaid emitting plain SVG text nodes instead of `<foreignObject>` HTML
 * labels, so the DOMPurify svg profile below is a safe sink even though
 * mermaid already sanitizes its own output internally in strict mode — this
 * is a second defense-in-depth layer, same posture as ViewerOverlay/CodePre.
 *
 * Invalid mermaid source never crashes the page: mermaid.render() rejects,
 * we fall back to the raw source in a plain pre, and — because a rejected
 * render still leaves an orphan `d<id>` measurement div behind in
 * document.body (mermaid only calls its own cleanup on the success path) —
 * we remove it ourselves in the catch block.
 */
export function MermaidBlock({ block }: { block: MermaidBlockType }) {
  const rawId = useId()
  const mermaidId = cssId(rawId)
  const { theme } = useTheme()
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setFailed(false)

    import('mermaid').then(async ({ default: mermaid }) => {
      if (cancelled) return
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: THEME_VARIABLES[theme],
        flowchart: { htmlLabels: false },
      })
      try {
        const result = await mermaid.render(mermaidId, block.code)
        if (!cancelled) setSvg(result.svg)
      } catch {
        // mermaid leaves an orphan `d<id>` (and sometimes `<id>`) element in
        // document.body when render() rejects — see task-6-report.md.
        document.getElementById(`d${mermaidId}`)?.remove()
        document.getElementById(mermaidId)?.remove()
        if (!cancelled) setFailed(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [block.code, mermaidId, theme])

  const safeSvg =
    svg === null ? null : DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true, html: true } })

  if (failed) {
    return (
      <DiagramCard caption={block.title ?? 'Diagram'} expandable={false}>
        <pre className={FALLBACK_PRE_CLASS}>
          <code>{block.code}</code>
        </pre>
        <p className="mt-1.5 font-mono text-[10.5px] text-faint">Diagram source could not be rendered</p>
      </DiagramCard>
    )
  }

  return (
    <DiagramCard caption={block.title ?? 'Diagram'}>
      {safeSvg ? (
        <div
          className="flex justify-center overflow-x-auto"
          // safeSvg is mermaid-generated markup from this block's own code
          // (never remote/user HTML) — see the component doc comment above.
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
          dangerouslySetInnerHTML={{ __html: safeSvg }}
        />
      ) : (
        <pre className={FALLBACK_PRE_CLASS}>
          <code>{block.code}</code>
        </pre>
      )}
    </DiagramCard>
  )
}
