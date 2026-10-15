'use client'
import { Component, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { Block, StoredBlock } from '@brief/schema'
import type { BlockAnchor } from './blockAnchor'
import { BlockCard, LOADING, MATH_BODY, cardHeader } from './BlockCard'
import { Paragraph } from './blocks/Paragraph'
import { Callout } from './blocks/Callout'
import { DataTable } from './blocks/DataTable'
import { Compare } from './blocks/Compare'
import { Stats } from './blocks/Stats'
import { Coverage } from './blocks/Coverage'
import { Details } from './blocks/Details'
import { Trajectory } from './blocks/Trajectory'
import { UnknownBlock } from './blocks/UnknownBlock'
import { Seq } from './blocks/Seq'
import { StateMachine } from './blocks/StateMachine'
import { Layers } from './blocks/Layers'
import { Erd } from './blocks/Erd'
import { CodeBlock } from './blocks/CodeBlock'
import { BeforeAfter } from './blocks/BeforeAfter'
import { BigO } from './blocks/BigO'
import { Heatmap } from './blocks/Heatmap'
import { Histogram } from './blocks/Histogram'
import { Scatter } from './blocks/Scatter'
import { Plot3d } from './blocks/Plot3d'
import { List } from './blocks/List'
import { Walkthrough } from './blocks/Walkthrough'
import type { MathBlock as MathBlockComponent } from './blocks/MathBlock'
import type { MermaidBlock as MermaidBlockComponent } from './blocks/MermaidBlock'
import { diagramDeclaration, mermaidBoxHeight } from '../lib/mermaidSource'

// next/dynamic renders `loading`, which gets no props, so it reads the block
// from LazyBlock.
const LazyBlock = createContext<{ block: Block; anchor: BlockAnchor } | null>(null)

function LazyBlockLoading() {
  const lazy = useContext(LazyBlock)
  if (lazy === null) return null
  const { block, anchor } = lazy
  if (block.type === 'mermaid') {
    // The same box MermaidBlock reserves, so the card keeps its height when the chunk arrives.
    return (
      <BlockCard
        {...cardHeader(block, anchor)}
        captionPrefix={diagramDeclaration(block.code)}
        fullScreen="pending"
        state={LOADING.diagram}
      >
        <div className="p-5">
          <div className="sk rounded-[4px]" style={{ height: mermaidBoxHeight(block.code) }} />
        </div>
      </BlockCard>
    )
  }
  return (
    <BlockCard {...cardHeader(block, anchor)} state={LOADING.math}>
      <div className={MATH_BODY}>
        <div className="sk self-stretch flex-1 rounded-[4px]" />
      </div>
    </BlockCard>
  )
}

const DynamicMathBlock = dynamic<{ block: Extract<Block, { type: 'math' }> } & BlockAnchor>(
  () => import('./blocks/MathBlock').then((m): typeof MathBlockComponent => m.MathBlock),
  { ssr: false, loading: LazyBlockLoading },
)

const DynamicMermaidBlock = dynamic<{ block: Extract<Block, { type: 'mermaid' }> } & BlockAnchor>(
  () => import('./blocks/MermaidBlock').then((m): typeof MermaidBlockComponent => m.MermaidBlock),
  { ssr: false, loading: LazyBlockLoading },
)

class BlockBoundary extends Component<{ block: StoredBlock; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(previous: { block: StoredBlock }) {
    if (this.state.failed && previous.block !== this.props.block) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    const { block } = this.props
    return (
      <BlockCard
        kind={block.type}
        state={{ status: 'error', message: 'This block could not be drawn.', raw: block }}
      />
    )
  }
}

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
}: { block: StoredBlock } & BlockAnchor) {
  // Every block takes the same anchor: which section, which block, and where in
  // the payload this block's leaves live. A diagram or a code block gets it too
  // — its title/filename header is prose the reader can question, and used to be
  // the one thing on the card they could not.
  const anchor = { sid, bid, pathPrefix, annotatable, onMarkClick }

  return <BlockBoundary block={block}>{renderBlock(block, anchor)}</BlockBoundary>
}

function renderBlock(block: StoredBlock, anchor: BlockAnchor): ReactNode {
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
      return (
        <LazyBlock.Provider value={{ block, anchor }}>
          <DynamicMathBlock block={block} {...anchor} />
        </LazyBlock.Provider>
      )
    case 'mermaid':
      return (
        <LazyBlock.Provider value={{ block, anchor }}>
          <DynamicMermaidBlock block={block} {...anchor} />
        </LazyBlock.Provider>
      )
    case 'bigo':
      return <BigO block={block} {...anchor} />
    case 'heatmap':
      return <Heatmap block={block} {...anchor} />
    case 'histogram':
      return <Histogram block={block} {...anchor} />
    case 'scatter':
      return <Scatter block={block} {...anchor} />
    case 'plot3d':
      return <Plot3d block={block} {...anchor} />
    case 'list':
      return <List block={block} {...anchor} />
    case 'unreadable':
      return <UnknownBlock block={block.raw} />
    case 'trajectory':
      return <Trajectory block={block} {...anchor} />
    case 'walkthrough':
      return <Walkthrough block={block} {...anchor} />
    default:
      return <UnknownBlock block={block} />
  }
}
