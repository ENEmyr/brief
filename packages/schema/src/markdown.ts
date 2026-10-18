import type { Align, CodeNote, Decision, DiffChange, FlowNodeKind, GlossaryEntry, StoredBlock, StoredPayload, StoredSection, UnreadableBlock } from './payload'

type BlockOf<T extends StoredBlock['type']> = Extract<StoredBlock, { type: T }>

const mmId = (s: string) => s.replace(/\W/g, '_')

/**
 * Sanitize interpolated text before it lands inside a mermaid statement.
 * Newlines always collapse to a space (mermaid statements are single-line).
 * < and > become mermaid's own entity codes, so a renderer with htmlLabels
 * draws them as text instead of parsing the label as HTML.
 * `extra` strips characters that would break the specific syntax the text
 * is being dropped into (pipe-delimited edge labels, quoted strings).
 */
interface MmTextOptions {
  pipe?: boolean
  quote?: boolean
}

function oneLine(s: string): string {
  return s.replace(/\r\n|\r|\n/g, ' ')
}

function mmText(s: string, extra?: MmTextOptions): string {
  let out = oneLine(s).replaceAll('<', '#lt;').replaceAll('>', '#gt;')
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
  // through as is, apart from what mmText strips or escapes.
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
  return oneLine(s.replaceAll('|', String.raw`\|`))
}

const ALIGN_RULE: Record<Align, string> = { left: ':---', center: ':---:', right: '---:' }

function table(head: string[], rows: string[][], align?: Align[]): string {
  return [
    `| ${head.map(tableCell).join(' | ')} |`,
    `| ${head.map((_, i) => { const a = align?.[i]; return a ? ALIGN_RULE[a] : '---' }).join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(tableCell).join(' | ')} |`),
  ].join('\n')
}

/**
 * Fence body content so a literal ``` inside it can't terminate the block
 * early. Uses one more backtick than the longest backtick run found in the
 * body (minimum 3), matching CommonMark's fenced-code-block rule. The info
 * string must stay on the opening line and, after backticks, hold none.
 */
function fence(lang: string, body: string): string {
  const runs = body.match(/`+/g) ?? []
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0)
  const ticks = '`'.repeat(Math.max(3, longest + 1))
  return `${ticks}${oneLine(lang).replaceAll('`', '')}\n${body}\n${ticks}`
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
  const items = b.items
    .map((i) => {
      const hint = i.hint ? ` (${i.hint})` : ''
      const spark = i.spark ? `; trend: ${i.spark.join(', ')}` : ''
      return `- **${i.label}**: ${i.value}${hint}${spark}`
    })
    .join('\n')
  return `${captionPrefix(b.caption)}${items}`
}

function emitList(b: BlockOf<'list'>): string {
  const items = b.items.map((item, i) => `${b.ordered ? `${i + 1}.` : '-'} ${oneLine(item)}`).join('\n')
  return `${captionPrefix(b.caption)}${items}`
}

function lineRange(from: number, to?: number): string {
  return to && to !== from ? `L${from}-${to}` : `L${from}`
}

function noteLines(notes: (CodeNote & { side?: string })[] | undefined): string {
  if (!notes?.length) return ''
  const lines = notes.map((n) => {
    const side = n.side ? `${n.side} ` : ''
    return `- ${side}${lineRange(n.from, n.to)}: ${oneLine(n.text)}`
  })
  return `\n\nAgent notes:\n${lines.join('\n')}`
}

function emitSeq(b: BlockOf<'seq'>): string {
  const diagram = fence('mermaid', seqToMermaid(b))
  if (!b.steps.some((s) => s.text)) return diagram
  const steps = b.steps.map((s, i) => `${i + 1}. ${oneLine(s.text ?? s.label)}`).join('\n')
  return `${diagram}\n\nSteps:\n${steps}`
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
  const filename = b.filename ? `\`${b.filename}\`\n\n` : ''
  const beforeTitle = b.titleBefore ? ` (${b.titleBefore})` : ''
  const afterTitle = b.titleAfter ? ` (${b.titleAfter})` : ''
  return `${filename}**Before**${beforeTitle}\n\n${fence(b.language, b.before)}\n\n**After**${afterTitle}\n\n${fence(b.language, b.after)}${noteLines(b.notes)}`
}

function emitBigO(b: BlockOf<'bigo'>): string {
  const series = b.series.map((s) => `${s.label} is O(${s.curve})`).join(', ')
  return `Complexity comparison: ${series}.`
}

function emitCode(b: BlockOf<'code'>): string {
  const filename = b.filename ? `\`${b.filename}\`\n\n` : ''
  return `${filename}${fence(b.language, b.code)}${noteLines(b.notes)}`
}

function emitHeatmap(b: BlockOf<'heatmap'>): string {
  const title = b.title ? `: ${b.title}` : ''
  const rows = b.yLabels.map((y, i) => [y, ...(b.values[i] ?? []).map(String)])
  return `Heatmap${title}\n\n${table(['', ...b.xLabels], rows)}`
}

function emitHistogram(b: BlockOf<'histogram'>): string {
  const title = b.title ? `: ${b.title}` : ''
  const rows = b.bins.map((x) => [x.label, String(x.count)])
  return `Histogram${title}\n\n${table(['bin', 'count'], rows)}${histogramThreshold(b)}`
}

function histogramThreshold(b: BlockOf<'histogram'>): string {
  if (!b.threshold) return ''
  const { bin, label, value } = b.threshold
  const named = oneLine(value ? `${label} ${value}` : label)
  const from = b.bins[bin - 1]
  const past = from ? ` (bins from "${oneLine(from.label)}" on are past it)` : ''
  return `\n\nThreshold: ${named}${past}`
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

const FLOW_SHAPE: Record<FlowNodeKind, [string, string]> = { start: ['(["', '"])'], end: ['(["', '"])'], decision: ['{"', '"}'], step: ['["', '"]'] }

function flowchart(nodes: { id: string; label: string; kind?: FlowNodeKind }[], edges: { from: string; to: string; label?: string }[]): string {
  const lines = ['flowchart TD']
  for (const n of nodes) {
    const [open, close] = FLOW_SHAPE[n.kind ?? 'step']
    lines.push(`  ${mmId(n.id)}${open}${mmText(n.label, { quote: true })}${close}`)
  }
  for (const e of edges) {
    const label = e.label ? `|${mmText(e.label, { pipe: true })}|` : ''
    lines.push(`  ${mmId(e.from)} --> ${label}${mmId(e.to)}`)
  }
  return lines.join('\n')
}

function emitWalkthrough(b: BlockOf<'walkthrough'>): string {
  const head = [b.filename && `\`${oneLine(b.filename)}\``, b.title && oneLine(b.title)].filter(Boolean).join(' / ')
  const steps = b.steps.map((s, i) => `${i + 1}. ${lineRange(s.from, s.to)}: ${oneLine(s.title)} (flow: ${s.nodes.map(oneLine).join(', ')})`)
  return `${head ? `${head}\n\n` : ''}${fence(b.language, b.code)}\n\nWalkthrough:\n${steps.join('\n')}\n\n${fence('mermaid', flowchart(b.flow.nodes, b.flow.edges))}`
}

function diffChangeLine(c: DiffChange): string {
  const steps = c.steps?.length ? ` Steps: ${c.steps.map(oneLine).join('; ')}.` : ''
  return `- ${c.change} \`${oneLine(c.symbol)}\`: ${oneLine(c.summary)}${steps}`
}

function emitDiffFile(f: BlockOf<'diff'>['files'][number]): string {
  const path = f.from ? `\`${oneLine(f.from)}\` -> \`${oneLine(f.path)}\`` : `\`${oneLine(f.path)}\``
  const parts = [`**${f.status}** ${path}${f.folded ? ' (folded)' : ''}`]
  if (f.changes?.length) parts.push(f.changes.map(diffChangeLine).join('\n'))
  if (f.patch) parts.push(fence('diff', f.patch))
  return parts.join('\n\n')
}

function emitDiff(b: BlockOf<'diff'>): string {
  const files = b.files.map(emitDiffFile).join('\n\n')
  if (!b.map) return files
  const nodes = b.map.nodes.map((n) => ({ id: n.id, label: n.status ? `${n.label} (${n.status})` : n.label }))
  return `${files}\n\nChange map:\n\n${fence('mermaid', flowchart(nodes, b.map.edges))}`
}

function emitTrajectory(b: BlockOf<'trajectory'>): string {
  const totals = [b.steps.length === 1 ? '1 step' : `${b.steps.length} steps`]
  if (b.stats?.seconds !== undefined) totals.push(`${b.stats.seconds} s`)
  if (b.stats?.tokens !== undefined) totals.push(`${b.stats.tokens} tokens`)
  const rows = b.steps.map((s) => [s.at, s.kind, s.title, s.detail ?? '', s.flag ? 'ask the reader' : ''])
  return `Agent trajectory: ${totals.join(', ')}\n\n${table(['at (UTC)', 'kind', 'step', 'detail', 'flag'], rows)}`
}

function emitImage(b: BlockOf<'image'>): string {
  return `${captionPrefix(b.caption && oneLine(b.caption))}[Image \`${b.imageId}\`: ${oneLine(b.alt)}]`
}

function emitUnreadable(b: UnreadableBlock): string {
  const raw = b.raw as { type?: unknown } | null
  const type = typeof raw?.type === 'string' ? raw.type.replace(/[^\w-]/g, '').slice(0, 40) : ''
  return `[Block not shown: this version of Brief cannot read a "${type || 'unknown'}" block.]`
}

function blockToMarkdown(b: StoredBlock): string {
  switch (b.type) {
    case 'p': return b.text
    case 'note': return emitCallout('NOTE', b)
    case 'warn': return emitCallout('WARNING', b)
    case 'good': return emitCallout('TIP', b)
    case 'table': return `${captionPrefix(b.caption)}${table(b.head, b.rows, b.align)}`
    case 'compare': return emitCompare(b)
    case 'stat': return emitStat(b)
    case 'coverage': return emitCoverage(b)
    case 'details': return emitDetails(b)
    case 'seq': return emitSeq(b)
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
    case 'list': return emitList(b)
    case 'walkthrough': return emitWalkthrough(b)
    case 'diff': return emitDiff(b)
    case 'trajectory': return emitTrajectory(b)
    case 'image': return emitImage(b)
    case 'unreadable': return emitUnreadable(b)
    default: return assertNever(b)
  }
}

function decisionContext(d: Decision, sections: StoredSection[]): string {
  const named = (d.refs ?? []).flatMap((ref) => {
    const s = sections.find((x) => x.id === ref)
    return s ? [`${String(s.no).padStart(2, '0')} ${oneLine(s.title)}`] : []
  })
  return named.length ? `\n\nContext: ${named.join('; ')}` : ''
}

function glossaryLine(g: GlossaryEntry): string {
  const aliases = g.aliases?.length ? ` (also: ${g.aliases.map(oneLine).join(', ')})` : ''
  return `- **${oneLine(g.term)}**${aliases}: ${oneLine(g.def)}`
}

function decisionToMarkdown(d: Decision, sections: StoredSection[]): string {
  const opts = d.opts
    .map((o) => {
      const detail = o.detail ? ` : ${o.detail}` : ''
      return `- [ ] \`${o.id}\` ${o.label}${detail}`
    })
    .join('\n')
  const mode = d.multi ? 'multi-select' : 'single-select'
  const why = d.why ? `\n\nWhy this matters: ${d.why}` : ''
  return `### ${d.q}\n\n(id: \`${d.id}\`, ${mode})${decisionContext(d, sections)}\n\n${opts}${why}`
}

export function payloadToMarkdown(payload: StoredPayload, opts: { url: string }): string {
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
    for (const d of payload.decisions) parts.push(decisionToMarkdown(d, payload.sections))
  }
  if (payload.glossary?.length) {
    parts.push('## Glossary', payload.glossary.map(glossaryLine).join('\n'))
  }
  return parts.join('\n\n') + '\n'
}
