'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import type { Block } from '@brief/schema'
import { BlockCard, LOADING, cardHeader, type BlockCardState } from '../BlockCard'
import { SourceListing } from '../BlockError'
import type { BlockAnchor } from '../blockAnchor'
import { useDiagramFullScreen } from '../fullScreen'
import { FOCUS_RING } from '../topbarChrome'
import { diagramDeclaration, escapeLabelGt, mermaidBoxHeight, parseErrorLine } from '../../lib/mermaidSource'
import { useTheme, beginThemedRender, readColorTokens, readFontStack } from '@/features/theme'
import type { Theme } from '@/features/theme'

type MermaidBlockType = Extract<Block, { type: 'mermaid' }>

// B-Blocks2:102 sets mermaid labels at 13px, the node label size of the other
// diagrams. This belongs in themeVariables, not as a top-level `fontSize` on
// initialize(): with theme 'base' plus an explicit themeVariables object, label
// sizing is read from here.
const LABEL_FONT_SIZE = '13px'

/**
 * The mermaid themeVariables listed on B-Blocks2, as resolved token values:
 * mermaid computes colors and measures text in its own detached DOM, so it
 * needs real values rather than var(). Effect-only (reads the DOM).
 */
function mermaidThemeVariables(theme: Theme) {
  const c = readColorTokens(theme, ['card', 'elev', 'line2', 'text', 'sub', 'accent-soft', 'code-bg'])
  return {
    background: c.card,
    primaryColor: c.elev,
    primaryBorderColor: c.line2,
    primaryTextColor: c.text,
    lineColor: c.sub,
    secondaryColor: c['accent-soft'],
    tertiaryColor: c['code-bg'],
    // Unset, mermaid tints edge label boxes from secondaryColor; the board's
    // labels sit on the canvas with no box (B-Blocks2:107, :109).
    edgeLabelBackground: c.card,
    fontFamily: readFontStack('sans'),
    fontSize: LABEL_FONT_SIZE,
  }
}

/** Mermaid draws its label boxes at half opacity, so a line would run through the text. */
const THEME_CSS = '.edgeLabel rect { opacity: 1; }'

/** B-Blocks2:104, :108, :110: node boxes have 6px corners; mermaid draws `[text]` square. */
const NODE_RADIUS = '6'

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


/**
 * Sanitizes mermaid's svg and pins its natural size: mermaid writes
 * `width="100%"` and a `max-width` style, which leaves the svg no size of its
 * own inside a box that shrinks to fit (the viewer) or a box of fixed height
 * (the card). Width and height from the viewBox make it scale like an image.
 * Square node boxes get the board's corners; shapes that set their own keep them.
 */
function sanitizeAtNaturalSize(svg: string): string {
  const body = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true, html: true },
    RETURN_DOM: true,
  }) as HTMLElement
  const root = body.querySelector('svg')
  const box = root?.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
  if (root && box && box.length === 4 && box.every(Number.isFinite)) {
    root.setAttribute('width', String(box[2]))
    root.setAttribute('height', String(box[3]))
    root.style.removeProperty('max-width')
  }
  for (const box of body.querySelectorAll('g.node rect.label-container:not([rx])')) {
    box.setAttribute('rx', NODE_RADIUS)
    box.setAttribute('ry', NODE_RADIUS)
  }
  return body.innerHTML
}

// useId() returns something like ":r0:" — strip everything but
// alphanumerics/hyphens so the result is a valid CSS id for mermaid.render.
function cssId(id: string): string {
  return `mm-${id.replace(/[^a-zA-Z0-9-]/g, '')}`
}

/**
 * Mermaid-rendered diagram block. `mermaid` is imported lazily inside the
 * effect (never enters the first-load chunk). Re-initializes and re-renders
 * whenever the app theme flips, with that theme's token values (see
 * mermaidThemeVariables above).
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
  const [failure, setFailure] = useState<{ line?: number } | null>(null)
  const [view, setView] = useState<'diagram' | 'source'>('diagram')

  useEffect(() => {
    let cancelled = false
    const callId = `${mermaidId}-r${++renderSeq.current}`
    setSvg(null)
    setFailure(null)
    // Tracked so lib/print.ts can wait for this diagram's redraw in the
    // print-forced palette before handing off to window.print() -- see
    // features/theme's beginThemedRender doc comment.
    const endThemedRender = beginThemedRender()

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
        themeVariables: mermaidThemeVariables(theme),
        // BOTH htmlLabels keys are required: mermaid 11 ignores the
        // flowchart-scoped one alone (labels stay foreignObject HTML and
        // DOMPurify's svg profile strips them to empty boxes) — the
        // top-level key is the one that switches labels to pure SVG text.
        // See the component doc comment.
        htmlLabels: false,
        flowchart: FLOWCHART_CONFIG,
        themeCSS: THEME_CSS,
      })
      try {
        const result = await mermaid.render(callId, escapeLabelGt(block.code))
        if (!cancelled) setSvg(result.svg)
      } catch (error) {
        removeTempNodes()
        if (!cancelled) setFailure({ line: parseErrorLine(error, block.code) })
      }
    }).finally(endThemedRender)

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

  const safeSvg = useMemo(() => (svg === null ? null : sanitizeAtNaturalSize(svg)), [svg])

  const diagram = safeSvg ? (
    <div
      className="flex items-center justify-center"
      // safeSvg is mermaid-generated markup from this block's own code
      // (never remote/user HTML) — see the component doc comment above.
      // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      dangerouslySetInnerHTML={{ __html: safeSvg }}
    />
  ) : null
  const onFullScreen = useDiagramFullScreen(diagram, { heading: { kind: block.type, title: block.title } })
  const declaration = diagramDeclaration(block.code)
  const boxHeight = mermaidBoxHeight(block.code)

  if (failure) {
    const state: BlockCardState = {
      status: 'error',
      message: failure.line === undefined ? 'Diagram could not be drawn.' : `Diagram could not be drawn. Parse error on line ${failure.line}.`,
      source: block.code,
      lineNumber: failure.line,
    }
    return <BlockCard {...cardHeader(block, anchor)} captionSuffix={declaration} state={state} />
  }

  const controls = diagram ? <ViewToggle view={view} onChange={setView} /> : undefined

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      captionSuffix={declaration}
      controls={controls}
      fullScreen={diagram ? onFullScreen : 'pending'}
      state={diagram ? undefined : LOADING.diagram}
    >
      {diagram && view === 'source' ? (
        <div className="p-3">
          <SourceListing source={block.code} />
        </div>
      ) : (
        <div className="p-5">
          {/* The box has its final height before mermaid arrives (B-States:107); the
              diagram scales down into it, never up, and full screen shows it 1:1. */}
          <div
            className={`[&>div]:size-full [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:max-w-full ${diagram ? '' : 'sk rounded-[4px]'}`}
            style={{ height: boxHeight }}
          >
            {diagram}
          </div>
        </div>
      )}
    </BlockCard>
  )
}

const VIEWS = ['diagram', 'source'] as const

/** B-Blocks2:98: a 26px segmented toggle; 44 under 880, where the frame drops to keep the header 53. */
function ViewToggle({ view, onChange }: { view: 'diagram' | 'source'; onChange: (view: 'diagram' | 'source') => void }) {
  return (
    <div
      role="group"
      aria-label="View"
      className="flex shrink-0 gap-0.5 rounded-[4px] border border-line bg-page p-0.5 max-[880px]:border-0 max-[880px]:p-0"
    >
      {VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={`min-h-[26px] rounded-[3px] px-2 text-[11px] transition-[background-color] duration-[var(--dur-fast)] motion-reduce:transition-none max-[880px]:min-h-11 ${FOCUS_RING} ${
            view === v ? 'bg-chip text-text' : 'bg-transparent text-faint hover:text-text'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
