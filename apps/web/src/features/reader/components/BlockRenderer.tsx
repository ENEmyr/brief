'use client'
import dynamic from 'next/dynamic'
import type { Block } from '@brief/schema'
import { Paragraph } from './blocks/Paragraph'
import { Callout } from './blocks/Callout'
import { DataTable } from './blocks/DataTable'
import { Compare } from './blocks/Compare'
import { Stats } from './blocks/Stats'
import { Coverage } from './blocks/Coverage'
import { Details } from './blocks/Details'
import { UnknownBlock } from './blocks/UnknownBlock'
import { WidgetPlaceholder } from './blocks/WidgetPlaceholder'
import { Seq } from './blocks/Seq'
import { StateMachine } from './blocks/StateMachine'
import { Layers } from './blocks/Layers'
import { Erd } from './blocks/Erd'
import { CodeBlock } from './blocks/CodeBlock'
import { BeforeAfter } from './blocks/BeforeAfter'
import type { MathBlock as MathBlockComponent } from './blocks/MathBlock'
import type { MermaidBlock as MermaidBlockComponent } from './blocks/MermaidBlock'

// katex/mermaid are only ever needed once a math/mermaid block actually
// mounts, so both components are routed through next/dynamic({ ssr: false })
// — this is what keeps katex/mermaid (and MathBlock's static katex CSS
// import) out of the /s route's first-load JS.
//
// next/dynamic's `loading` component is rendered while the MathBlock.tsx /
// MermaidBlock.tsx chunk itself is still being fetched — it does NOT receive
// the props passed to the eventual component (block is not available here),
// so this is a generic, content-free placeholder. Each block's own raw
// source ("the raw latex/code in a plain pre" the brief asks for) is instead
// rendered by MathBlock/MermaidBlock themselves as their initial state,
// before their own lazy katex/mermaid import resolves — see those files.
function DynamicChunkLoading() {
  return (
    <pre className="m-0 h-16 overflow-x-auto rounded-xl border border-line bg-card p-4 font-mono text-[12.5px] leading-[1.7] text-sub" />
  )
}

const DynamicMathBlock = dynamic<{ block: Extract<Block, { type: 'math' }> }>(
  () => import('./blocks/MathBlock').then((m): typeof MathBlockComponent => m.MathBlock),
  { ssr: false, loading: DynamicChunkLoading },
)

const DynamicMermaidBlock = dynamic<{ block: Extract<Block, { type: 'mermaid' }> }>(
  () => import('./blocks/MermaidBlock').then((m): typeof MermaidBlockComponent => m.MermaidBlock),
  { ssr: false, loading: DynamicChunkLoading },
)

// The remaining diagram/chart block types that don't have a real component
// yet (Plan 3 tasks 7-8 swap each of these in as a one-line case above the
// default). Checked at runtime, not just inferred from the type union,
// since arbitrary/legacy payloads can still reach the default branch.
const WIDGET_TYPES = new Set<Block['type']>([
  'bigo',
  'heatmap', 'histogram', 'scatter', 'plot3d',
])

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'p':
      return <Paragraph block={block} />
    case 'note':
    case 'warn':
    case 'good':
      return <Callout block={block} />
    case 'table':
      return <DataTable block={block} />
    case 'compare':
      return <Compare block={block} />
    case 'stat':
      return <Stats block={block} />
    case 'coverage':
      return <Coverage block={block} />
    case 'details':
      return <Details block={block} />
    case 'seq':
      return <Seq block={block} />
    case 'state':
      return <StateMachine block={block} />
    case 'layers':
      return <Layers block={block} />
    case 'erd':
      return <Erd block={block} />
    case 'code':
      return <CodeBlock block={block} />
    case 'ba':
      return <BeforeAfter block={block} />
    case 'math':
      return <DynamicMathBlock block={block} />
    case 'mermaid':
      return <DynamicMermaidBlock block={block} />
    default:
      return WIDGET_TYPES.has(block.type) ? <WidgetPlaceholder block={block} /> : <UnknownBlock block={block} />
  }
}
