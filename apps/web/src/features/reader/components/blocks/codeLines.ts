import type { Element, ElementContent, Root } from 'hast'
import { DEFAULT_HIGHLIGHT_PATH } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import { markStacks } from '@/features/annotations'

/**
 * Shiki's `codeToHast` output is `<pre><code>` with exactly one
 * `<span class="line">` per entry of `code.split('\n')` (including a
 * trailing empty one for a trailing newline), separated by literal `"\n"`
 * text nodes that are siblings of the line spans, not their children. That
 * one-to-one order is what lets line index `i` be addressed as its own
 * annotatable leaf, path `code.<i>`: this file only ever looks inside a
 * single line's own children, never across the separators.
 */
export function extractLineNodes(root: Root): Element[] {
  const pre = root.children.find(isElementWithTag('pre'))
  const code = pre?.children.find(isElementWithTag('code'))
  return (code?.children.filter(isLineSpan) ?? []).map(numbersOnly)
}

const CONSTANT_COLOR = 'var(--shiki-token-constant)'
const NUMBER = /^\s*[-+]?\.?\d/

/**
 * Shiki's css-variables theme gives one variable to numbers and to object,
 * constant and property names alike. The boards color only numbers that way
 * (B-Reader:158 `30`); `key`, `req` and `env.LIMITER` stay in the text color
 * (B-Reader:155-158, B-NewBlocks:126-130). So a constant-colored token that is
 * not a number goes back to the foreground. Shiki merges a leading space into
 * the token after it, so a number may start with whitespace.
 */
function numbersOnly(node: Element): Element {
  return {
    ...node,
    children: node.children.map((child) => {
      if (child.type !== 'element') return child
      const style = child.properties?.style
      if (
        typeof style === 'string' &&
        style.includes(CONSTANT_COLOR) &&
        !NUMBER.test(lineText(child))
      ) {
        return {
          ...child,
          properties: {
            ...child.properties,
            style: style.replace(CONSTANT_COLOR, 'var(--shiki-foreground)'),
          },
        }
      }
      return numbersOnly(child)
    }),
  }
}

function isElementWithTag(tagName: string) {
  return (node: { type: string; tagName?: string }): node is Element =>
    node.type === 'element' && node.tagName === tagName
}

/**
 * shiki is inconsistent about how it stores an element's `class`: a plain,
 * never-transformed line is a space-joined STRING (`"line"`), but its own
 * `addClassToHast` rewrites it into a string ARRAY the moment a second class is added
 * (`["line", "hl-line"]`). Every reader here has to accept both shapes, or a
 * highlighted line silently falls out of a `typeof === 'string'` check.
 */
function classListOf(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean)
  if (Array.isArray(value)) return value.map(String)
  return []
}

/** An element's own class list, joined back into the space-separated string
 * a React `className` prop expects -- see classListOf for why this can't
 * just read `properties.class` directly. */
export function classNameOf(node: Element): string {
  return classListOf(node.properties?.class).join(' ')
}

function isLineSpan(node: ElementContent): node is Element {
  return node.type === 'element' && node.tagName === 'span' && classListOf(node.properties?.class).includes('line')
}

/** The line span's own class list, falling back to plain `"line"` on the
 * (never expected in practice) chance a line span carries no class at all. */
export function lineClassName(node: Element): string {
  return classNameOf(node) || 'line'
}

/** The line's own flattened text -- must equal the matching entry of
 * `code.split('\n')` exactly, which is the per-line anchor invariant. */
export function lineText(node: Element): string {
  return node.children.map(childText).join('')
}

function childText(node: ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(childText).join('')
  return ''
}

interface CharStyle {
  style?: string
  className?: string
}

function styleOf(node: Element, inherited: CharStyle): CharStyle {
  const props = node.properties ?? {}
  const ownClassName = classListOf(props.class).join(' ')
  return {
    style: typeof props.style === 'string' ? props.style : inherited.style,
    className: ownClassName || inherited.className,
  }
}

function sameStyle(a: CharStyle, b: CharStyle): boolean {
  return a.style === b.style && a.className === b.className
}

/** Expands a line's token spans into one entry per character, carrying
 * whichever token's color/style that character came from. Regrouping runs of
 * this array (see `pushRun` in `renderLineChildren`) is what lets a highlight
 * split a token anywhere -- including mid-token -- without losing that
 * token's color on either side of the split. */
function collectChars(nodes: ElementContent[], inherited: CharStyle): { ch: string; style: CharStyle }[] {
  const out: { ch: string; style: CharStyle }[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      for (let i = 0; i < node.value.length; i++) out.push({ ch: node.value[i]!, style: inherited })
    } else if (node.type === 'element') {
      out.push(...collectChars(node.children, styleOf(node, inherited)))
    }
  }
  return out
}

function styledNode(text: string, style: CharStyle): ElementContent {
  if (style.style === undefined && style.className === undefined) {
    return { type: 'text', value: text }
  }
  const properties: Record<string, string> = {}
  if (style.className !== undefined) properties.class = style.className
  if (style.style !== undefined) properties.style = style.style
  return { type: 'element', tagName: 'span', properties, children: [{ type: 'text', value: text }] }
}

/** Same highlight/mark/note/ask styling as HighlightedText, ported to hast
 * nodes instead of a JSX fragment (a line is coloured token spans, not one
 * plain string, so HighlightedText's own string-slicing can't be reused
 * as-is). `data-mark-id` is read back by CodePre's click handler, since
 * a hast node can't carry a function onClick the way HighlightedText's
 * `<mark>` does. */
function markNode(h: Highlight, children: ElementContent[], withMarker: boolean): ElementContent {
  const isAsk = h.question !== undefined
  return {
    type: 'element',
    tagName: 'mark',
    properties: {
      'data-mark-id': h.id,
      'data-marker': withMarker ? (isAsk ? 'ask' : h.note !== null ? 'note' : undefined) : undefined,
      class: isAsk
        ? 'cursor-pointer rounded-[3px] bg-accent-soft px-[2px] text-accent-text'
        : 'cursor-pointer rounded-[3px] px-[2px]',
      style: isAsk
        ? 'box-shadow:inset 0 -2px 0 var(--c-accent-line)'
        : 'background:var(--c-mark);color:var(--c-mark-text)',
    },
    children,
  }
}

/**
 * Splices `highlights` into a line's coloured token spans as `<mark>` hast
 * elements, with the same owner rule as HighlightedText (markStacks), so each
 * character draws once and only a highlight's last piece carries its marker. Returns
 * the line's own children unchanged when there is nothing to paint, so an
 * unhighlighted line costs nothing beyond the filter that got it here.
 */
export function renderLineChildren(node: Element, highlights: Highlight[]): ElementContent[] {
  if (!highlights.length) return node.children

  const chars = collectChars(node.children, {})
  const owner = markStacks(
    [...highlights].sort((a, b) => a.start - b.start),
    chars.length,
  )
  const lastPiece = new Map<Highlight, number>()
  owner.forEach((s, i) => {
    if (s?.[0]) lastPiece.set(s[0], i)
  })
  const out: ElementContent[] = []

  function pushRun(from: number, to: number, target: ElementContent[]) {
    let start = from
    while (start < to) {
      let end = start + 1
      while (end < to && sameStyle(chars[start]!.style, chars[end]!.style)) end++
      target.push(styledNode(chars.slice(start, end).map((c) => c.ch).join(''), chars[start]!.style))
      start = end
    }
  }

  let i = 0
  while (i < chars.length) {
    const stack = owner[i] ?? null
    let j = i + 1
    while (j < chars.length && (owner[j] ?? null) === stack) j++
    if (stack?.[0]) {
      const withMarker = lastPiece.get(stack[0]) === j - 1
      const inner: ElementContent[] = []
      pushRun(i, j, inner)
      out.push(stack.reduceRight((children, h) => [markNode(h, children, withMarker)], inner)[0]!)
    } else pushRun(i, j, out)
    i = j
  }

  return out
}

/** Highlights for one code line: same rules as HighlightedText's own filter
 * (sid/bid/path match, and the stored text must still match what's at those
 * offsets today -- a stale anchor is dropped rather than painted). */
export function highlightsForLine(
  highlights: Highlight[],
  sid: number | undefined,
  bid: number | null,
  path: string,
  text: string,
): Highlight[] {
  if (sid === undefined) return []
  return highlights.filter(
    (h) =>
      h.sid === sid &&
      (h.bid ?? null) === bid &&
      (h.path ?? DEFAULT_HIGHLIGHT_PATH) === path &&
      text.slice(h.start, h.end) === h.text,
  )
}

/** True when `a` and `b` hold the same Highlight objects in the same order.
 * Every mutation in reader-state replaces the whole `highlights` array but
 * keeps untouched Highlight objects by reference (see store.ts's
 * `commit`/spread pattern), so two filtered subsets from before/after an
 * unrelated edit are reference-equal element-by-element -- that's what lets
 * a 500-line code block skip re-converting the 499 lines a highlight change
 * elsewhere didn't touch. */
export function sameHighlightList(a: Highlight[], b: Highlight[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((h, i) => h === b[i])
}

export interface PreAttrs {
  className: string
  style: Record<string, string>
  tabIndex?: number
}

/** The `<pre>` element's own class/style/tabindex, read off the hast tree
 * rather than hardcoded: the theme is shiki's css-variables theme, but the
 * exact class/colors it emits are shiki's to own, not this component's to
 * duplicate. */
export function preAttrsFrom(root: Root): PreAttrs {
  const pre = root.children.find(isElementWithTag('pre'))
  const props = pre?.properties ?? {}
  const className = (pre && classNameOf(pre)) || 'shiki'
  const style = typeof props.style === 'string' ? parseInlineStyle(props.style) : {}
  const tabIndexAttr = props.tabindex
  const tabIndex =
    typeof tabIndexAttr === 'string' || typeof tabIndexAttr === 'number' ? Number(tabIndexAttr) : undefined
  return { className, style, tabIndex }
}

function parseInlineStyle(css: string): Record<string, string> {
  const style: Record<string, string> = {}
  for (const decl of css.split(';')) {
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    const prop = decl.slice(0, idx).trim()
    const value = decl.slice(idx + 1).trim()
    if (!prop || !value) continue
    style[prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value
  }
  return style
}
