import type { Block, Decision, Payload } from './payload'

type BlockOf<T extends Block['type']> = Extract<Block, { type: T }>

const mmId = (s: string) => s.replace(/\W/g, '_')

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
  if (extra?.pipe) out = out.replaceAll('|', '')
  if (extra?.quote) out = out.replaceAll('"', '')
  return out
}

function seqToMermaid(b: BlockOf<'seq'>): string {
  const lines = ['sequenceDiagram']
  for (const a of b.actors) lines.push(`  participant ${mmId(a)} as ${mmText(a)}`)
  for (const s of b.steps) {
    lines.push(`  ${mmId(s.from)}->>${mmId(s.to)}: ${mmText(s.label)}`)
    if (s.note) lines.push(`  Note over ${mmId(s.to)}: ${mmText(s.note)}`)
  }
  return lines.join('\n')
}

function stateToMermaid(b: BlockOf<'state'>): string {
  const lines = ['stateDiagram-v2', `  [*] --> ${mmId(b.initial)}`]
  for (const s of b.states) lines.push(`  ${mmId(s.id)}: ${mmText(s.label)}`)
  for (const t of b.transitions) {
    const label = t.label ? `: ${mmText(t.label)}` : ''
    lines.push(`  ${mmId(t.from)} --> ${mmId(t.to)}${label}`)
  }
  return lines.join('\n')
}

function layersToMermaid(b: BlockOf<'layers'>): string {
  // Flowchart labels are always emitted in quoted form (id["label"]): inside
  // quotes, brackets, parens and pipes are all legal, so label text passes
  // through verbatim. Inner double quotes are stripped by mmText.
  const lines = ['flowchart TD']
  for (const layer of b.layers) {
    lines.push(`  subgraph ${mmId(layer.id)}["${mmText(layer.label, { quote: true })}"]`)
    for (const n of layer.nodes) lines.push(`    ${mmId(n.id)}["${mmText(n.label, { quote: true })}"]`)
    lines.push('  end')
    for (const e of layer.edges) {
      const label = e.label ? `|${mmText(e.label, { pipe: true })}|` : ''
      lines.push(`  ${mmId(e.from)} --> ${label}${mmId(e.to)}`)
    }
  }
  return lines.join('\n')
}

function erdColumnLine(c: BlockOf<'erd'>['tables'][number]['columns'][number]): string {
  // Attribute type and name must both be single ATTRIBUTE_WORDs: a quote,
  // space or other punctuation in either breaks erDiagram parsing.
  let key = ''
  if (c.pk) {
    key = ' PK'
  } else if (c.fk) {
    key = ' FK'
  }
  return `    ${mmId(c.type)} ${mmId(c.name)}${key}`
}

function erdToMermaid(b: BlockOf<'erd'>): string {
  const lines = ['erDiagram']
  for (const t of b.tables) {
    lines.push(`  ${mmId(t.name)} {`)
    for (const c of t.columns) lines.push(erdColumnLine(c))
    lines.push('  }')
  }
  for (const t of b.tables)
    for (const c of t.columns)
      if (c.fk) lines.push(`  ${mmId(c.fk.table)} ||--o{ ${mmId(t.name)} : "${mmText(c.name, { quote: true })}"`)
  return lines.join('\n')
}

function tableCell(s: string): string {
  return s.replaceAll('|', String.raw`\|`).replace(/\r\n|\r|\n/g, ' ')
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

function captionPrefix(caption: string | undefined): string {
  return caption ? `**${caption}**\n\n` : ''
}

function emitCallout(kind: string, b: { title?: string; text: string }): string {
  const title = b.title ? ` ${b.title}` : ''
  return `> [!${kind}]${title}\n> ${b.text}`
}

function compareSide(s: BlockOf<'compare'>['left']): string {
  const tag = s.tag ? ` (${s.tag})` : ''
  const items = s.items.map((i) => `- ${i.ok ? '(+)' : '(-)'} ${i.text}`).join('\n')
  return `**${s.title}${tag}**\n${items}`
}

function emitCompare(b: BlockOf<'compare'>): string {
  return `${captionPrefix(b.caption)}${compareSide(b.left)}\n\n${compareSide(b.right)}`
}

function emitStat(b: BlockOf<'stat'>): string {
  return b.items
    .map((i) => {
      const hint = i.hint ? ` (${i.hint})` : ''
      return `- **${i.label}**: ${i.value}${hint}`
    })
    .join('\n')
}

function emitCoverage(b: BlockOf<'coverage'>): string {
  const items = b.items
    .map((i) => {
      const note = i.note ? ` (${i.note})` : ''
      return `- ${i.label}: ${i.status}${note}`
    })
    .join('\n')
  return `${captionPrefix(b.caption)}${items}`
}

function emitDetails(b: BlockOf<'details'>): string {
  const inner = b.blocks.map(blockToMarkdown).join('\n\n')
  return `<details>\n<summary>${b.summary}</summary>\n\n${inner}\n\n</details>`
}

function emitBeforeAfter(b: BlockOf<'ba'>): string {
  const beforeTitle = b.titleBefore ? ` (${b.titleBefore})` : ''
  const afterTitle = b.titleAfter ? ` (${b.titleAfter})` : ''
  return `**Before**${beforeTitle}\n\n${fence(b.language, b.before)}\n\n**After**${afterTitle}\n\n${fence(b.language, b.after)}`
}

function emitBigO(b: BlockOf<'bigo'>): string {
  const series = b.series.map((s) => `${s.label} is O(${s.curve})`).join(', ')
  return `Complexity comparison: ${series}.`
}

function emitCode(b: BlockOf<'code'>): string {
  const filename = b.filename ? `\`${b.filename}\`\n\n` : ''
  return `${filename}${fence(b.language, b.code)}`
}

function emitHeatmap(b: BlockOf<'heatmap'>): string {
  const title = b.title ? `: ${b.title}` : ''
  const rows = b.yLabels.map((y, i) => [y, ...(b.values[i] ?? []).map(String)])
  return `Heatmap${title}\n\n${table(['', ...b.xLabels], rows)}`
}

function emitHistogram(b: BlockOf<'histogram'>): string {
  const title = b.title ? `: ${b.title}` : ''
  const rows = b.bins.map((x) => [x.label, String(x.count)])
  return `Histogram${title}\n\n${table(['bin', 'count'], rows)}`
}

function emitScatter(b: BlockOf<'scatter'>): string {
  const title = b.title ? `: ${b.title}` : ''
  const series = b.series
    .map((s) => {
      const points = s.points.map(([x, y]) => `(${x}, ${y})`).join(' ')
      return `${s.label}: ${points}`
    })
    .join('\n')
  return `Scatter${title}\n\n${series}`
}

function emitPlot3d(b: BlockOf<'plot3d'>): string {
  const title = b.title ? `: ${b.title}` : ''
  let points = ''
  if (b.points) {
    const list = b.points.map((p) => `(${p.join(', ')})`).join(' ')
    points = `\n\npoints: ${list}`
  }
  return `3D plot (${b.kind})${title}${points}`
}

function blockToMarkdown(b: Block): string {
  switch (b.type) {
    case 'p': return b.text
    case 'note': return emitCallout('NOTE', b)
    case 'warn': return emitCallout('WARNING', b)
    case 'good': return emitCallout('TIP', b)
    case 'table': return `${captionPrefix(b.caption)}${table(b.head, b.rows)}`
    case 'compare': return emitCompare(b)
    case 'stat': return emitStat(b)
    case 'coverage': return emitCoverage(b)
    case 'details': return emitDetails(b)
    case 'seq': return fence('mermaid', seqToMermaid(b))
    case 'state': return fence('mermaid', stateToMermaid(b))
    case 'layers': return fence('mermaid', layersToMermaid(b))
    case 'erd': return fence('mermaid', erdToMermaid(b))
    case 'ba': return emitBeforeAfter(b)
    case 'bigo': return emitBigO(b)
    case 'code': return emitCode(b)
    case 'mermaid': return fence('mermaid', b.code)
    case 'math': return `$$\n${b.latex}\n$$`
    case 'heatmap': return emitHeatmap(b)
    case 'histogram': return emitHistogram(b)
    case 'scatter': return emitScatter(b)
    case 'plot3d': return emitPlot3d(b)
    default: return assertNever(b)
  }
}

function decisionToMarkdown(d: Decision): string {
  const opts = d.opts
    .map((o) => {
      const detail = o.detail ? ` : ${o.detail}` : ''
      return `- [ ] \`${o.id}\` ${o.label}${detail}`
    })
    .join('\n')
  const mode = d.multi ? 'multi-select' : 'single-select'
  const why = d.why ? `\n\nWhy this matters: ${d.why}` : ''
  return `### ${d.q}\n\n(id: \`${d.id}\`, ${mode})\n\n${opts}${why}`
}

export function payloadToMarkdown(payload: Payload, opts: { url: string }): string {
  const parts: string[] = []
  parts.push(
    `<!--\nThis file is the complete machine-readable source of the Brief session at\n${opts.url}\nAgents: read this file directly. Do not scrape the HTML page.\nBlock semantics: mermaid fences are diagrams, $$ fences are LaTeX math,\ncode fences carry the original language tag, github alerts are callouts.\n-->`,
    `# ${payload.meta.title}`,
  )
  if (payload.meta.subtitle) {
    parts.push(payload.meta.subtitle)
  }
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
