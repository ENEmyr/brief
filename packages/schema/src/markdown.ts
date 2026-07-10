import type { Block, Decision, Payload } from './payload'

const mmId = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_')

/**
 * Sanitize interpolated text before it lands inside a mermaid statement.
 * Newlines always collapse to a space (mermaid statements are single-line).
 * `extra` strips characters that would break the specific syntax the text
 * is being dropped into (pipe-delimited edge labels, quoted strings).
 */
interface MmTextOptions {
  pipe?: boolean
  quote?: boolean
}

function mmText(s: string, extra?: MmTextOptions): string {
  let out = s.replace(/\r\n|\r|\n/g, ' ')
  if (extra?.pipe) out = out.replace(/\|/g, '')
  if (extra?.quote) out = out.replace(/"/g, '')
  return out
}

function seqToMermaid(b: Extract<Block, { type: 'seq' }>): string {
  const lines = ['sequenceDiagram']
  for (const a of b.actors) lines.push(`  participant ${mmId(a)} as ${mmText(a)}`)
  for (const s of b.steps) {
    lines.push(`  ${mmId(s.from)}->>${mmId(s.to)}: ${mmText(s.label)}`)
    if (s.note) lines.push(`  Note over ${mmId(s.to)}: ${mmText(s.note)}`)
  }
  return lines.join('\n')
}

function stateToMermaid(b: Extract<Block, { type: 'state' }>): string {
  const lines = ['stateDiagram-v2', `  [*] --> ${mmId(b.initial)}`]
  for (const s of b.states) lines.push(`  ${mmId(s.id)}: ${mmText(s.label)}`)
  for (const t of b.transitions) lines.push(`  ${mmId(t.from)} --> ${mmId(t.to)}${t.label ? `: ${mmText(t.label)}` : ''}`)
  return lines.join('\n')
}

function layersToMermaid(b: Extract<Block, { type: 'layers' }>): string {
  // Flowchart labels are always emitted in quoted form (id["label"]): inside
  // quotes, brackets, parens and pipes are all legal, so label text passes
  // through verbatim. Inner double quotes are stripped by mmText.
  const lines = ['flowchart TD']
  for (const layer of b.layers) {
    lines.push(`  subgraph ${mmId(layer.id)}["${mmText(layer.label, { quote: true })}"]`)
    for (const n of layer.nodes) lines.push(`    ${mmId(n.id)}["${mmText(n.label, { quote: true })}"]`)
    lines.push('  end')
    for (const e of layer.edges) lines.push(`  ${mmId(e.from)} --> ${e.label ? `|${mmText(e.label, { pipe: true })}|` : ''}${mmId(e.to)}`)
  }
  return lines.join('\n')
}

function erdToMermaid(b: Extract<Block, { type: 'erd' }>): string {
  const lines = ['erDiagram']
  for (const t of b.tables) {
    lines.push(`  ${mmId(t.name)} {`)
    // Attribute type and name must both be single ATTRIBUTE_WORDs: a quote,
    // space or other punctuation in either breaks erDiagram parsing.
    for (const c of t.columns) lines.push(`    ${mmId(c.type)} ${mmId(c.name)}${c.pk ? ' PK' : c.fk ? ' FK' : ''}`)
    lines.push('  }')
  }
  for (const t of b.tables)
    for (const c of t.columns)
      if (c.fk) lines.push(`  ${mmId(c.fk.table)} ||--o{ ${mmId(t.name)} : "${mmText(c.name, { quote: true })}"`)
  return lines.join('\n')
}

function tableCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, ' ')
}

function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.map(tableCell).join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(tableCell).join(' | ')} |`),
  ].join('\n')
}

/**
 * Fence body content so a literal ``` inside it can't terminate the block
 * early. Uses one more backtick than the longest backtick run found in the
 * body (minimum 3), matching CommonMark's fenced-code-block rule.
 */
function fence(lang: string, body: string): string {
  const runs = body.match(/`+/g) ?? []
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0)
  const ticks = '`'.repeat(Math.max(3, longest + 1))
  return `${ticks}${lang}\n${body}\n${ticks}`
}

function assertNever(x: never): never {
  throw new Error(`Unhandled block type: ${JSON.stringify(x)}`)
}

function blockToMarkdown(b: Block): string {
  switch (b.type) {
    case 'p': return b.text
    case 'note': return `> [!NOTE]${b.title ? ` ${b.title}` : ''}\n> ${b.text}`
    case 'warn': return `> [!WARNING]${b.title ? ` ${b.title}` : ''}\n> ${b.text}`
    case 'good': return `> [!TIP]${b.title ? ` ${b.title}` : ''}\n> ${b.text}`
    case 'table': return `${b.caption ? `**${b.caption}**\n\n` : ''}${table(b.head, b.rows)}`
    case 'compare': {
      const side = (s: typeof b.left) => `**${s.title}**\n${s.items.map((i) => `- ${i.ok ? '(+)' : '(-)'} ${i.text}`).join('\n')}`
      return `${side(b.left)}\n\n${side(b.right)}`
    }
    case 'stat': return b.items.map((i) => `- **${i.label}**: ${i.value}${i.hint ? ` (${i.hint})` : ''}`).join('\n')
    case 'coverage': return b.items.map((i) => `- ${i.label}: ${i.status}${i.note ? ` (${i.note})` : ''}`).join('\n')
    case 'details': return `<details>\n<summary>${b.summary}</summary>\n\n${b.blocks.map(blockToMarkdown).join('\n\n')}\n\n</details>`
    case 'seq': return fence('mermaid', seqToMermaid(b))
    case 'state': return fence('mermaid', stateToMermaid(b))
    case 'layers': return fence('mermaid', layersToMermaid(b))
    case 'erd': return fence('mermaid', erdToMermaid(b))
    case 'ba': return `**Before**${b.titleBefore ? ` (${b.titleBefore})` : ''}\n\n${fence(b.language, b.before)}\n\n**After**${b.titleAfter ? ` (${b.titleAfter})` : ''}\n\n${fence(b.language, b.after)}`
    case 'bigo': return `Complexity comparison: ${b.series.map((s) => `${s.label} is O(${s.curve})`).join(', ')}.`
    case 'code': return `${b.filename ? `\`${b.filename}\`\n\n` : ''}${fence(b.language, b.code)}`
    case 'mermaid': return fence('mermaid', b.code)
    case 'math': return `$$\n${b.latex}\n$$`
    case 'heatmap': return `Heatmap${b.title ? `: ${b.title}` : ''}\n\n${table(['', ...b.xLabels], b.yLabels.map((y, i) => [y, ...(b.values[i] ?? []).map(String)]))}`
    case 'histogram': return `Histogram${b.title ? `: ${b.title}` : ''}\n\n${table(['bin', 'count'], b.bins.map((x) => [x.label, String(x.count)]))}`
    case 'scatter': return `Scatter${b.title ? `: ${b.title}` : ''}\n\n${b.series.map((s) => `${s.label}: ${s.points.map(([x, y]) => `(${x}, ${y})`).join(' ')}`).join('\n')}`
    case 'plot3d': return `3D plot (${b.kind})${b.title ? `: ${b.title}` : ''}${b.points ? `\n\npoints: ${b.points.map((p) => `(${p.join(', ')})`).join(' ')}` : ''}`
    default: return assertNever(b)
  }
}

function decisionToMarkdown(d: Decision): string {
  const opts = d.opts.map((o) => `- [ ] \`${o.id}\` ${o.label}${o.detail ? ` : ${o.detail}` : ''}`).join('\n')
  return `### ${d.q}\n\n(id: \`${d.id}\`, ${d.multi ? 'multi-select' : 'single-select'})\n\n${opts}${d.why ? `\n\nWhy this matters: ${d.why}` : ''}`
}

export function payloadToMarkdown(payload: Payload, opts: { url: string }): string {
  const parts: string[] = []
  parts.push(
    `<!--\nThis file is the complete machine-readable source of the Brief session at\n${opts.url}\nAgents: read this file directly. Do not scrape the HTML page.\nBlock semantics: mermaid fences are diagrams, $$ fences are LaTeX math,\ncode fences carry the original language tag, github alerts are callouts.\n-->`,
  )
  parts.push(`# ${payload.meta.title}`)
  if (payload.meta.subtitle) {
    parts.push(payload.meta.subtitle)
  }
  const metaBits = [
    payload.meta.author && `author: ${payload.meta.author}`,
    payload.meta.version && `version: ${payload.meta.version}`,
    payload.meta.repo && `repo: ${payload.meta.repo}`,
    payload.meta.date && `date: ${payload.meta.date}`,
  ].filter(Boolean)
  const metaRows: string[][] = []
  if (payload.meta.author) metaRows.push(['author', payload.meta.author])
  if (payload.meta.version) metaRows.push(['version', payload.meta.version])
  if (payload.meta.repo) metaRows.push(['repo', payload.meta.repo])
  if (payload.meta.date) metaRows.push(['date', payload.meta.date])
  if (payload.meta.docId) metaRows.push(['doc', payload.meta.docId])
  if (metaRows.length) parts.push(table(['field', 'value'], metaRows))
  for (const s of payload.sections) {
    parts.push(`## ${s.no}. ${s.title}`)
    for (const b of s.blocks) parts.push(blockToMarkdown(b))
  }
  if (payload.decisions.length) {
    parts.push('## Decisions')
    for (const d of payload.decisions) parts.push(decisionToMarkdown(d))
  }
  return parts.join('\n\n') + '\n'
}
