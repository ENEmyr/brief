/**
 * Source-level helpers for the mermaid block.
 *
 * Why `>` needs escaping (bug-402): the reader renders mermaid with
 * `htmlLabels: false` (DOMPurify strips the foreignObject HTML labels), and on
 * that path mermaid splits a plain label into words with
 * `/<[^>]+>|[^\s<>]+/g`, which has no match for a bare `>`. "tokens > 0" draws
 * as "tokens 0". Mermaid's own entity `#gt;` survives that split, so a `>`
 * that is label text is rewritten to it before rendering. A `>` that is
 * syntax (an arrow head, the asymmetric node opener `A>`, the end of `<br>`)
 * is left alone.
 */

const DECLARATION = /^\s*(flowchart|graph)\b/

const OPEN = new Set(['[', '(', '{'])
const CLOSE = new Set([']', ')', '}'])

/** The line that names the diagram type, after any front matter, blank lines and %% comments. */
function declarationIndex(lines: readonly string[]): number {
  let inFrontMatter = false
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()
    if (i === 0 && line === '---') {
      inFrontMatter = true
      continue
    }
    if (inFrontMatter) {
      if (line === '---') inFrontMatter = false
      continue
    }
    if (line === '' || line.startsWith('%%')) continue
    return i
  }
  return -1
}

function escapeLine(line: string): string {
  let out = ''
  let depth = 0
  let quoted = false
  let markdown = false
  let piped = false
  let tagOpen = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? ''
    const prev = line[i - 1] ?? ''
    const next = line[i + 1] ?? ''
    if (ch === '"') {
      quoted = !quoted
      markdown = quoted && next === '`'
    } else if (!quoted && OPEN.has(ch)) depth += 1
    else if (!quoted && CLOSE.has(ch)) depth = Math.max(0, depth - 1)
    else if (!quoted && depth === 0 && ch === '|') piped = !piped

    const inText = quoted || depth > 0 || piped
    if (ch === '<' && /[a-zA-Z/]/.test(next)) tagOpen = true
    if (ch === '>') {
      if (tagOpen) {
        tagOpen = false
      } else if (inText ? !markdown : /\s/.test(prev) && /\s/.test(next)) {
        out += '#gt;'
        continue
      }
    }
    out += ch
  }
  return out
}

/** Rewrites every `>` that is label text in a flowchart to `#gt;`; other diagram types pass through. */
export function escapeLabelGt(code: string): string {
  const lines = code.split('\n')
  const start = declarationIndex(lines)
  if (start < 0 || !DECLARATION.test(lines[start] ?? '')) return code
  return lines.map((line, i) => (i > start ? escapeLine(line) : line)).join('\n')
}

/** "flowchart LR", the line that declares the diagram (B-Blocks2:97, B-States:93). */
export function diagramDeclaration(code: string): string | undefined {
  const lines = code.split('\n')
  const line = lines[declarationIndex(lines)]?.trim()
  return line ? line.replace(/;.*$/, '').trim() : undefined
}

/**
 * The 1-based source line a mermaid parse error points at. The jison hash's
 * `loc.first_line` is where the bad token starts; the message's "line N" can
 * name the line after it (mermaid appends a newline, so an unclosed bracket at
 * the end reports the empty last line). Only a line inside the source counts.
 */
export function parseErrorLine(error: unknown, code: string): number | undefined {
  const hash = (error as { hash?: { loc?: { first_line?: unknown } } } | null)?.hash
  const fromHash = typeof hash?.loc?.first_line === 'number' ? hash.loc.first_line : undefined
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const fromMessage = /Parse error on line (\d+)/.exec(message)?.[1]
  const line = fromHash ?? (fromMessage ? Number(fromMessage) : undefined)
  const count = code.split('\n').length
  return line !== undefined && Number.isInteger(line) && line >= 1 && line <= count ? line : undefined
}

/**
 * The height a mermaid diagram gets in its card, known before mermaid loads so
 * the card never moves (B-States:107): a left-to-right flowchart gets the
 * 200px of B-Blocks2:102, anything taller the 400px of the board's tallest
 * diagram panel (B-Blocks:78). BlockRenderer's loading card uses the same rule.
 */
export function mermaidBoxHeight(code: string): number {
  return /^(flowchart|graph)\s+(LR|RL)\b/i.test(diagramDeclaration(code) ?? '') ? 200 : 400
}
