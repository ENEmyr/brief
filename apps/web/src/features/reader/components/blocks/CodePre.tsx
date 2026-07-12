'use client'
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { jsx, jsxs } from 'react/jsx-runtime'
import type { Element as HastElement, Root as HastRoot } from 'hast'
import { useReaderState } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import { highlightToHast } from '../../services/shiki'
import {
  extractLineNodes,
  highlightsForLine,
  lineClassName,
  preAttrsFrom,
  renderLineChildren,
  sameHighlightList,
} from './codeLines'

export interface CodePreProps {
  code: string
  language: string
  highlightLines?: number[]
  sid?: number
  bid?: number
  /** Dotted prefix for the block this code lives in (e.g. `blocks.0.` for a
   *  nested block), same convention as every other block's `pathPrefix`. */
  pathPrefix?: string
  /** Which payload field `code` came from -- CodeBlock's is always `code`,
   *  BeforeAfter's is `before` or `after` depending on which side is showing,
   *  so this can't be hardcoded here. Each line is addressed at
   *  `${pathPrefix}${field}.<line index>`. */
  field: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}

const PRE_CLASS = 'm-0 overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7]'

/**
 * One annotatable code line. Each `<span class="line">` shiki emits becomes
 * its own `[data-hl]` leaf at path `<field>.<index>` (`code.3`, `before.0`,
 * `after.12`) -- the same one-leaf-per-string rule as every other block, just
 * applied per line instead of per block, since a code block's flattened text
 * has no single honest offset space (a highlight's offsets must count into
 * ONE line, not the whole body with its embedded newlines).
 *
 * Converting a line's coloured token spans to JSX (`toJsxRuntime`) is the
 * expensive part of rendering a highlighted line, so it's memoized behind
 * `stable`: reader-state replaces the whole `highlights` array on every
 * mutation, but keeps untouched Highlight objects by reference, so an edit
 * to one line's highlight leaves every other line's filtered subset
 * reference-equal to what it was last render (see sameHighlightList). That
 * is what keeps an unrelated highlight elsewhere in the document from
 * re-converting all 500 lines of an unrelated code block.
 */
const CodeLine = memo(function CodeLine({
  node,
  text,
  sid,
  bid,
  path,
  annotatable,
  highlights,
  onMarkClick,
}: {
  node: HastElement
  text: string
  sid?: number
  bid: number | null
  path: string
  annotatable: boolean
  highlights: Highlight[]
  onMarkClick: (highlight: Highlight) => void
}) {
  const matches = highlightsForLine(highlights, sid, bid, path, text)
  const stableRef = useRef<Highlight[]>(matches)
  const stable = sameHighlightList(stableRef.current, matches) ? stableRef.current : matches
  stableRef.current = stable

  const rendered = useMemo(
    () => toJsxRuntime({ type: 'root', children: renderLineChildren(node, stable) }, { Fragment, jsx, jsxs }),
    [node, stable],
  )

  const canAnnotate = annotatable && sid !== undefined && text.length > 0
  const className = lineClassName(node)

  function handleClick(ev: ReactMouseEvent<HTMLSpanElement>) {
    if (!stable.length) return
    const target = ev.target
    if (!(target instanceof Element)) return
    const id = target.closest('mark[data-highlight-id]')?.getAttribute('data-highlight-id')
    const hit = id === null || id === undefined ? undefined : stable.find((h) => h.id === id)
    if (hit) onMarkClick(hit)
  }

  return (
    <span
      className={className}
      onClick={stable.length ? handleClick : undefined}
      {...(canAnnotate
        ? {
            'data-hl': '',
            'data-sid': sid,
            ...(bid === null ? {} : { 'data-bid': bid }),
            'data-path': path,
          }
        : {})}
    >
      {rendered}
    </span>
  )
})

/**
 * Shared code-panel body used by CodeBlock and BeforeAfter: renders a plain,
 * uncolored `<pre><code>` immediately (so the code is never blocked on the
 * lazy shiki import), then swaps in a shiki-highlighted, React-owned tree
 * once `highlightToHast` resolves. Both states share the same dark panel
 * look (`--code-bg` / fixed `#cdd6f4` text) per the prototype, which keeps a
 * dark code panel in both app themes — see globals.css.
 *
 * The highlighted tree is built from shiki's hast output via
 * hast-util-to-jsx-runtime rather than `dangerouslySetInnerHTML`: nothing
 * else makes the code annotatable, since the annotation model measures and
 * repaints highlights by walking/re-rendering the React tree, and neither
 * side of that can reach into a `dangerouslySetInnerHTML` subtree. Per-line
 * annotation loses cross-line selection (the toolbar only appears when a
 * selection resolves to one `[data-hl]` leaf, same as every other block),
 * which is an accepted limitation, not a bug.
 */
export function CodePre({
  code,
  language,
  highlightLines,
  sid,
  bid,
  pathPrefix = '',
  field,
  annotatable = true,
  onMarkClick = () => {},
}: CodePreProps) {
  const [hast, setHast] = useState<HastRoot | null>(null)
  const { highlights } = useReaderState()

  useEffect(() => {
    let cancelled = false
    setHast(null)
    highlightToHast(code, language, { highlightLines })
      .then((result) => {
        if (!cancelled) setHast(result)
      })
      .catch(() => {
        // highlightToHast() itself already falls back to plaintext internally
        // and should not reject; this guard just guarantees a rejected mock
        // (or an unforeseen failure) never leaves the component stuck
        // rendering the plain fallback forever without throwing.
      })
    return () => {
      cancelled = true
    }
  }, [code, language, highlightLines])

  if (hast) {
    const lineNodes = extractLineNodes(hast)
    const codeLines = code.split('\n')
    const pre = preAttrsFrom(hast)

    return (
      <pre className={`${PRE_CLASS} ${pre.className}`} style={pre.style} tabIndex={pre.tabIndex}>
        <code>
          {lineNodes.map((node, i) => (
            <Fragment key={i}>
              {i > 0 ? '\n' : null}
              <CodeLine
                node={node}
                text={codeLines[i] ?? ''}
                sid={sid}
                bid={bid ?? null}
                path={`${pathPrefix}${field}.${i}`}
                annotatable={annotatable}
                highlights={highlights}
                onMarkClick={onMarkClick}
              />
            </Fragment>
          ))}
        </code>
      </pre>
    )
  }

  return (
    <pre className={PRE_CLASS} style={{ background: 'var(--code-bg)', color: '#cdd6f4' }}>
      <code>{code}</code>
    </pre>
  )
}
