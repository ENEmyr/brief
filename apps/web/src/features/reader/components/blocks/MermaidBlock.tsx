'use client'
import { useEffect, useId, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { titleAnchor } from '../blockAnchor'
import type { BlockAnchor } from '../blockAnchor'
import { useTheme } from '@/features/theme'

type MermaidBlockType = Extract<Block, { type: 'mermaid' }>

// Literal Catppuccin hex values (not getComputedStyle — mermaid renders into
// its own detached temp DOM node before we ever see the resulting markup, so
// CSS custom properties on the document wouldn't be visible to it anyway).
// Mermaid's own default is 16px, which renders visibly heavier than the
// hand-rolled SVG blocks next to it (Erd/Seq/StateMachine/Layers all label at
// 9-11.5px inside a scaled viewBox). Note this belongs in themeVariables, not
// as a top-level `fontSize` on initialize(): with theme 'base' plus an explicit
// themeVariables object, label sizing is read from here.
const LABEL_FONT_SIZE = '12px'

const THEME_VARIABLES = {
  latte: {
    background: '#ffffff',
    primaryColor: '#f2ebfd',
    primaryTextColor: '#4c4f69',
    primaryBorderColor: '#8839ef',
    lineColor: '#6c6f85',
    fontFamily: 'IBM Plex Mono',
    fontSize: LABEL_FONT_SIZE,
  },
  mocha: {
    background: '#1e1e2e',
    primaryColor: 'rgba(203, 166, 247, .14)',
    primaryTextColor: '#cdd6f4',
    primaryBorderColor: '#cba6f7',
    lineColor: '#a6adc8',
    fontFamily: 'IBM Plex Mono',
    fontSize: LABEL_FONT_SIZE,
  },
} as const

// Layout knobs. Left at mermaid's defaults, dagre gets one unwrapped line per
// label (htmlLabels is off, so a label is a single SVG text run unless
// wrappingWidth forces a break), which inflates node widths and spreads the
// graph out until it is hard to read. Wrapping the labels is what actually
// tightens the layout; the spacing values just close the gaps that leaves.
const FLOWCHART_CONFIG = {
  htmlLabels: false,
  wrappingWidth: 160,
  nodeSpacing: 36,
  rankSpacing: 44,
  padding: 8,
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
 * `securityLevel: 'strict'` + `htmlLabels: false` keeps mermaid emitting
 * plain SVG text nodes instead of `<foreignObject>` HTML labels, so the
 * DOMPurify svg profile below is a safe sink even though mermaid already
 * sanitizes its own output internally in strict mode — this is a second
 * defense-in-depth layer, same posture as ViewerOverlay/CodePre.
 * IMPORTANT: mermaid 11 IGNORES `flowchart: { htmlLabels: false }` on its
 * own — node labels still come out as foreignObject HTML, which DOMPurify's
 * svg profile then strips, leaving EMPTY node boxes (verified empirically
 * in a real browser; see task-6-report.md follow-up 6b). The TOP-LEVEL
 * `htmlLabels: false` key is what actually switches labels to pure SVG
 * text; the flowchart-scoped one is kept as well for belt and suspenders.
 *
 * Invalid mermaid source never crashes the page: mermaid.render() rejects,
 * we fall back to the raw source in a plain pre, and — because a rejected
 * render still leaves an orphan `d<id>` measurement div behind in
 * document.body (mermaid only calls its own cleanup on the success path) —
 * we remove it ourselves in the catch block.
 *
 * The render id is unique PER INVOCATION (`mm-<useId>-r<n>` via a ref
 * counter), not just per component instance. mermaid.render keys its temp
 * DOM nodes in document.body by the id it's given, and its first step
 * (removeExistingElements) deletes any existing nodes with that id — so two
 * overlapping render() calls sharing one id (rapid theme toggle / code
 * change while the first render is still in flight) would have the second
 * call tear down the first call's in-use nodes mid-draw. A fresh id per
 * invocation makes overlapping renders operate on disjoint DOM. The effect
 * cleanup also removes that invocation's temp nodes, so a cancelled
 * in-flight render can't strand them in document.body.
 */
export function MermaidBlock({ block, ...anchor }: { block: MermaidBlockType } & BlockAnchor) {
  const rawId = useId()
  const mermaidId = cssId(rawId)
  const renderSeq = useRef(0)
  const { theme } = useTheme()
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const callId = `${mermaidId}-r${++renderSeq.current}`
    setSvg(null)
    setFailed(false)

    // mermaid.render(callId, ...) creates a temp `d<callId>` div (and the
    // `<callId>` svg inside it) directly in document.body; it only removes
    // them itself on the success path — see task-6-report.md.
    const removeTempNodes = () => {
      document.getElementById(`d${callId}`)?.remove()
      document.getElementById(callId)?.remove()
    }

    import('mermaid').then(async ({ default: mermaid }) => {
      if (cancelled) return
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: THEME_VARIABLES[theme],
        // BOTH htmlLabels keys are required: mermaid 11 ignores the
        // flowchart-scoped one alone (labels stay foreignObject HTML and
        // DOMPurify's svg profile strips them to empty boxes) — the
        // top-level key is the one that switches labels to pure SVG text.
        // See the component doc comment.
        htmlLabels: false,
        flowchart: FLOWCHART_CONFIG,
      })
      try {
        const result = await mermaid.render(callId, block.code)
        if (!cancelled) setSvg(result.svg)
      } catch {
        removeTempNodes()
        if (!cancelled) setFailed(true)
      }
    })

    return () => {
      cancelled = true
      // Best-effort: if this effect run's render was superseded while still
      // in flight, its temp nodes may already exist — remove them. (If
      // mermaid hasn't created them yet this is a no-op; a settle after
      // cleanup is covered by the catch's removeTempNodes / mermaid's own
      // success-path cleanup.)
      removeTempNodes()
    }
  }, [block.code, mermaidId, theme])

  const safeSvg =
    svg === null ? null : DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true, html: true } })

  if (failed) {
    return (
      <DiagramCard
        caption={block.title ?? 'Diagram'}
        {...titleAnchor(anchor, block.title)}
        expandable={false}
      >
        <pre className={FALLBACK_PRE_CLASS}>
          <code>{block.code}</code>
        </pre>
        <p className="mt-1.5 font-mono text-[10.5px] text-faint">Diagram source could not be rendered</p>
      </DiagramCard>
    )
  }

  return (
    <DiagramCard
      caption={block.title ?? 'Diagram'}
      {...titleAnchor(anchor, block.title)}
      expandable={svg !== null}
    >
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
