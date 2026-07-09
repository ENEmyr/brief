import type { Block, Decision, Payload } from './payload'

const mmId = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_')

function seqToMermaid(b: Extract<Block, { type: 'seq' }>): string {
  const lines = ['sequenceDiagram']
  for (const a of b.actors) lines.push(`  participant ${mmId(a)} as ${a}`)
  for (const s of b.steps) {
    lines.push(`  ${mmId(s.from)}->>${mmId(s.to)}: ${s.label}`)
    if (s.note) lines.push(`  Note over ${mmId(s.to)}: ${s.note}`)
  }
  return lines.join('\n')
}

function stateToMermaid(b: Extract<Block, { type: 'state' }>): string {
  const lines = ['stateDiagram-v2', `  [*] --> ${mmId(b.initial)}`]
  for (const s of b.states) lines.push(`  ${mmId(s.id)}: ${s.label}`)
  for (const t of b.transitions) lines.push(`  ${mmId(t.from)} --> ${mmId(t.to)}${t.label ? `: ${t.label}` : ''}`)
  return lines.join('\n')
}

function layersToMermaid(b: Extract<Block, { type: 'layers' }>): string {
  const lines = ['flowchart TD']
  for (const layer of b.layers) {
    lines.push(`  subgraph ${mmId(layer.id)}[${layer.label}]`)
    for (const n of layer.nodes) lines.push(`    ${mmId(n.id)}[${n.label}]`)
    lines.push('  end')
    for (const e of layer.edges) lines.push(`  ${mmId(e.from)} --> ${e.label ? `|${e.label}|` : ''}${mmId(e.to)}`)
  }
  return lines.join('\n')
}

function erdToMermaid(b: Extract<Block, { type: 'erd' }>): string {
  const lines = ['erDiagram']
  for (const t of b.tables) {
    lines.push(`  ${mmId(t.name)} {`)
    for (const c of t.columns) lines.push(`    ${c.type.replace(/\s/g, '_')} ${c.name}${c.pk ? ' PK' : c.fk ? ' FK' : ''}`)
    lines.push('  }')
  }
  for (const t of b.tables)
    for (const c of t.columns)
      if (c.fk) lines.push(`  ${mmId(c.fk.table)} ||--o{ ${mmId(t.name)} : "${c.name}"`)
  return lines.join('\n')
}

function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')
}

const fence = (lang: string, body: string) => `\`\`\`${lang}\n${body}\n\`\`\``

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
  const metaBits = [
    payload.meta.author && `author: ${payload.meta.author}`,
    payload.meta.version && `version: ${payload.meta.version}`,
    payload.meta.repo && `repo: ${payload.meta.repo}`,
    payload.meta.date && `date: ${payload.meta.date}`,
  ].filter(Boolean)
  if (metaBits.length) parts.push(metaBits.join(' | '))
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
