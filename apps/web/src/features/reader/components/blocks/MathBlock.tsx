'use client'
import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import type { Block } from '@brief/schema'
import { BlockCard, LOADING, cardHeader, type BlockCardState } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
// Static import at module scope is safe here only because MathBlock itself
// is loaded via next/dynamic({ ssr: false }) in BlockRenderer — the CSS
// still lands in that lazy chunk rather than the app's first-load bundle.
import 'katex/dist/katex.min.css'

type MathBlockType = Extract<Block, { type: 'math' }>

// A lazy block keeps its final height from first paint (B-States:105-108).
// Before KaTeX draws, the only known height is the loading skeleton's: 128 with
// 12 around it (B-States:106, BlockRenderer's loading card). The body keeps that
// as its least height and centers the source, then the formula, in it.
const BODY = 'flex min-h-[152px] items-center justify-center-safe overflow-x-auto p-3'

type Rendered =
  | typeof LOADING.math
  | { status: 'ready'; html: string }
  | Extract<BlockCardState, { status: 'error' }>

function failed(source: string, line?: number): Rendered {
  return {
    status: 'error',
    message:
      line === undefined
        ? 'This block could not be drawn.'
        : `Math could not be drawn. Parse error on line ${line}.`,
    source,
    lineNumber: line,
  }
}

/**
 * The 1-based line KaTeX's ParseError points at, from its character offset
 * (the end of input is offset === length), or undefined for any other throw.
 */
function parseErrorLine(source: string, error: unknown): number | undefined {
  if (!(error instanceof Error) || error.name !== 'ParseError' || !('position' in error))
    return undefined
  return typeof error.position === 'number'
    ? source.slice(0, error.position).split('\n').length
    : undefined
}

/**
 * KaTeX-rendered equation block. `katex` is imported lazily inside the
 * effect so its ~250KB never enters the first-load chunk (see BlockRenderer
 * for the next/dynamic wrapper that keeps this component itself lazy too).
 * Bad LaTeX fails inside the card (B-States:92-98, features.md B6): the
 * source with the parser's line marked, and fixed copy only, because KaTeX's
 * own message quotes the source and is not written for a reader.
 */
export function MathBlock({ block, ...anchor }: { block: MathBlockType } & BlockAnchor) {
  const [rendered, setRendered] = useState<Rendered>(LOADING.math)

  useEffect(() => {
    let cancelled = false
    setRendered(LOADING.math)
    import('katex')
      .then(({ renderToString }) => {
        if (cancelled) return
        try {
          const html = renderToString(block.latex, {
            throwOnError: true,
            displayMode: true,
            output: 'html',
          })
          setRendered({
            status: 'ready',
            html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }),
          })
        } catch (error) {
          setRendered(failed(block.latex, parseErrorLine(block.latex, error)))
        }
      })
      .catch(() => {
        if (!cancelled) setRendered(failed(block.latex))
      })
    return () => {
      cancelled = true
    }
  }, [block.latex])

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      state={rendered.status === 'ready' ? undefined : rendered}
    >
      {rendered.status !== 'ready' ? (
        <pre className={`${BODY} m-0 font-mono text-[13px] leading-5 text-sub`}>
          <code>{block.latex}</code>
        </pre>
      ) : (
        <div
          data-math
          className={`${BODY} text-text`}
          // The html is KaTeX-generated markup from this block's own latex
          // source (never remote/user HTML), sanitized above as defense in
          // depth — same posture as CodePre's shiki sink (verified
          // empirically that USE_PROFILES:{html:true} preserves KaTeX's
          // classes/inline styles byte-for-byte; see task-6-report.md).
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
          dangerouslySetInnerHTML={{ __html: rendered.html }}
        />
      )}
    </BlockCard>
  )
}
