'use client'
import dynamic from 'next/dynamic'
import type { Block } from '@brief/schema'
import type { BlockAnchor } from './blockAnchor'
import { Paragraph } from './blocks/Paragraph'
import { Callout } from './blocks/Callout'
import { DataTable } from './blocks/DataTable'
import { Compare } from './blocks/Compare'
import { Stats } from './blocks/Stats'
import { Coverage } from './blocks/Coverage'
import { Details } from './blocks/Details'
import { UnknownBlock } from './blocks/UnknownBlock'
import { Seq } from './blocks/Seq'
import { StateMachine } from './blocks/StateMachine'
import { Layers } from './blocks/Layers'
import { Erd } from './blocks/Erd'
import { CodeBlock } from './blocks/CodeBlock'
import { BeforeAfter } from './blocks/BeforeAfter'
import type { MathBlock as MathBlockComponent } from './blocks/MathBlock'
import type { MermaidBlock as MermaidBlockComponent } from './blocks/MermaidBlock'
import type { BigO as BigOComponent } from './blocks/BigO'
import type { Heatmap as HeatmapComponent } from './blocks/Heatmap'
import type { Histogram as HistogramComponent } from './blocks/Histogram'
import type { Scatter as ScatterComponent } from './blocks/Scatter'
import type { Plot3d as Plot3dComponent } from './blocks/Plot3d'

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

const DynamicMathBlock = dynamic<{ block: Extract<Block, { type: 'math' }> } & BlockAnchor>(
  () => import('./blocks/MathBlock').then((m): typeof MathBlockComponent => m.MathBlock),
  { ssr: false, loading: DynamicChunkLoading },
)

const DynamicMermaidBlock = dynamic<{ block: Extract<Block, { type: 'mermaid' }> } & BlockAnchor>(
  () => import('./blocks/MermaidBlock').then((m): typeof MermaidBlockComponent => m.MermaidBlock),
  { ssr: false, loading: DynamicChunkLoading },
)

// echarts (~1MB across the four chart modules it needs) must stay out of the
// first-load chunk exactly like katex/mermaid above — same dynamic()/ssr:
// false routing, with each block's own component owning the lazy
// import('echarts/...') calls (see services/echarts.ts).
const DynamicBigO = dynamic<{ block: Extract<Block, { type: 'bigo' }> } & BlockAnchor>(
  () => import('./blocks/BigO').then((m): typeof BigOComponent => m.BigO),
  { ssr: false, loading: DynamicChunkLoading },
)

const DynamicHeatmap = dynamic<{ block: Extract<Block, { type: 'heatmap' }> } & BlockAnchor>(
  () => import('./blocks/Heatmap').then((m): typeof HeatmapComponent => m.Heatmap),
  { ssr: false, loading: DynamicChunkLoading },
)

const DynamicHistogram = dynamic<{ block: Extract<Block, { type: 'histogram' }> } & BlockAnchor>(
  () => import('./blocks/Histogram').then((m): typeof HistogramComponent => m.Histogram),
  { ssr: false, loading: DynamicChunkLoading },
)

const DynamicScatter = dynamic<{ block: Extract<Block, { type: 'scatter' }> } & BlockAnchor>(
  () => import('./blocks/Scatter').then((m): typeof ScatterComponent => m.Scatter),
  { ssr: false, loading: DynamicChunkLoading },
)

// echarts-gl (~1MB on top of echarts/core) gets its own dynamic() boundary
// for the same reason as the four echarts blocks above — Plot3d.tsx owns the
// lazy `getEChartsGL()` import (see services/echarts.ts).
const DynamicPlot3d = dynamic<{ block: Extract<Block, { type: 'plot3d' }> } & BlockAnchor>(
  () => import('./blocks/Plot3d').then((m): typeof Plot3dComponent => m.Plot3d),
  { ssr: false, loading: DynamicChunkLoading },
)

// sid/bid deliberately have NO default: an absent index renders the paragraph
// as plain (non-annotatable) text instead of silently aliasing sid=0/bid=0,
// which would cross-contaminate highlights with section 0's first paragraph.
export function BlockRenderer({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: { block: Block } & BlockAnchor) {
  // Every block takes the same anchor: which section, which block, and where in
  // the payload this block's leaves live. A diagram or a code block gets it too
  // — its title/filename header is prose the reader can question, and used to be
  // the one thing on the card they could not.
  const anchor = { sid, bid, pathPrefix, annotatable, onMarkClick }

  switch (block.type) {
    case 'p':
      return <Paragraph block={block} {...anchor} />
    case 'note':
    case 'warn':
    case 'good':
      return <Callout block={block} {...anchor} />
    case 'table':
      return <DataTable block={block} {...anchor} />
    case 'compare':
      return <Compare block={block} {...anchor} />
    case 'stat':
      return <Stats block={block} {...anchor} />
    case 'coverage':
      return <Coverage block={block} {...anchor} />
    case 'details':
      return <Details block={block} {...anchor} />
    case 'seq':
      return <Seq block={block} {...anchor} />
    case 'state':
      return <StateMachine block={block} {...anchor} />
    case 'layers':
      return <Layers block={block} {...anchor} />
    case 'erd':
      return <Erd block={block} {...anchor} />
    case 'code':
      return <CodeBlock block={block} {...anchor} />
    case 'ba':
      return <BeforeAfter block={block} {...anchor} />
    case 'math':
      return <DynamicMathBlock block={block} {...anchor} />
    case 'mermaid':
      return <DynamicMermaidBlock block={block} {...anchor} />
    case 'bigo':
      return <DynamicBigO block={block} {...anchor} />
    case 'heatmap':
      return <DynamicHeatmap block={block} {...anchor} />
    case 'histogram':
      return <DynamicHistogram block={block} {...anchor} />
    case 'scatter':
      return <DynamicScatter block={block} {...anchor} />
    case 'plot3d':
      return <DynamicPlot3d block={block} {...anchor} />
    default:
      return <UnknownBlock block={block} />
  }
}
