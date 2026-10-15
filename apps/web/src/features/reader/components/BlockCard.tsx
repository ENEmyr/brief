'use client'
import { Fragment, type ReactNode } from 'react'
import type { StoredBlock, UnreadableBlock } from '@brief/schema'
import { CardCaption } from './CardCaption'
import { BlockError, RawBlock, type BlockErrorMessage } from './BlockError'
import { FOCUS_RING } from './topbarChrome'
import type { BlockAnchor, CaptionAnchor } from './blockAnchor'

export interface CardLeaf {
  text: string
  path: string
}

export type BlockCardState =
  | { status: 'ready' }
  | { status: 'loading'; label: string }
  | {
      status: 'error'
      message: BlockErrorMessage
      source?: string
      lineNumber?: number
      raw?: unknown
    }
  | { status: 'unsupported'; raw: unknown }

export interface BlockCardProps extends CaptionAnchor {
  kind: string
  caption?: CardLeaf
  /**
   * A count derived from the block, drawn in the caption after " / ":
   * "title / 6 messages" (B-Blocks:75, B-Blocks2:28), or alone without a title
   * (B-Reader:126).
   */
  captionSuffix?: ReactNode
  /** A kind word drawn before the title: "surface / title" (B-Blocks2:166), "flowchart LR / title" (B-Blocks2:97). */
  captionPrefix?: string
  /** Right-hand header text the boards draw: "3 rows", "log scale", "p95 marked". */
  meta?: ReactNode
  controls?: ReactNode
  /** 'pending' shows the button disabled: the block will open full screen once it has drawn. */
  fullScreen?: (() => void) | 'pending'
  state?: BlockCardState
  children?: ReactNode
}

const READY: BlockCardState = { status: 'ready' }

/** B-States lazy block: the header label while a block's library or chunk loads. */
export const LOADING = {
  chart: { status: 'loading', label: 'loading chart' },
  diagram: { status: 'loading', label: 'loading diagram' },
  math: { status: 'loading', label: 'loading math' },
  image: { status: 'loading', label: 'loading image' },
} as const satisfies Record<string, BlockCardState>

/**
 * A lazy block keeps its final height from first paint (B-States:105-108). The
 * math body reserves the board's formula box, 49 high (B-Blocks:169), from the
 * chunk's loading card through the KaTeX source to the drawn formula.
 */
export const MATH_BODY = 'flex min-h-[49px] items-center justify-center-safe overflow-x-auto p-3'

export function BlockCard({
  kind,
  caption,
  captionPrefix,
  captionSuffix,
  meta,
  controls,
  fullScreen,
  state = READY,
  children,
  ...anchor
}: BlockCardProps) {
  const failed = state.status === 'error' || state.status === 'unsupported'
  const shownControls = failed ? null : controls
  const shownFullScreen = failed ? undefined : fullScreen
  const hasButtons = Boolean(shownControls) || shownFullScreen !== undefined

  return (
    <figure className="m-0 min-w-0 overflow-hidden rounded-[6px] border border-line bg-card text-text">
      <div
        className={`flex items-center gap-2 border-b border-line font-mono text-[11px] leading-[normal] text-faint max-[880px]:gap-1.5 max-[880px]:pl-2.5 ${
          hasButtons ? 'py-1.5 pl-3 pr-1.5 max-[880px]:py-1 max-[880px]:pr-1' : 'px-3 py-2'
        }`}
      >
        <span
          data-kind-tag
          className={`shrink-0 rounded-[3px] border px-[5px] py-px ${
            state.status === 'unsupported'
              ? 'border-dashed border-warn-line text-warn'
              : 'border-line2'
          }`}
        >
          {kind}
        </span>
        <span className="min-w-0 flex-1 break-words">
          {state.status === 'unsupported'
            ? 'not supported here'
            : [
                captionPrefix,
                caption && <CardCaption {...anchor} text={caption.text} path={caption.path} />,
                captionSuffix,
              ]
                .filter(Boolean)
                .map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 ? ' / ' : null}
                    {part}
                  </Fragment>
                ))}
        </span>
        {meta}
        {state.status === 'loading' ? (
          <span className="save-pulse shrink-0 text-sub">{state.label}</span>
        ) : null}
        {shownControls}
        {shownFullScreen === undefined ? null : (
          <button
            type="button"
            aria-label="Open diagram full screen"
            disabled={shownFullScreen === 'pending'}
            onClick={shownFullScreen === 'pending' ? undefined : shownFullScreen}
            className={`flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-line2 bg-elev text-text transition-[background-color,transform] duration-[var(--dur-fast)] enabled:hover:bg-chip enabled:active:scale-[.97] disabled:opacity-45 motion-reduce:transition-none max-[880px]:size-11 print:hidden ${FOCUS_RING}`}
          >
            <FullScreenIcon />
          </button>
        )}
      </div>
      <CardBody state={state}>{children}</CardBody>
    </figure>
  )
}

function CardBody({ state, children }: { state: BlockCardState; children: ReactNode }) {
  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-2 p-3">
        <BlockError message={state.message} source={state.source} lineNumber={state.lineNumber} />
        {state.raw === undefined ? null : <RawBlock raw={state.raw} />}
      </div>
    )
  }
  if (state.status === 'unsupported') {
    return (
      <div className="flex flex-col gap-2 p-3">
        <p className="m-0 text-[13px] leading-5 text-sub">
          This reader does not know this block type yet. The content is below as data.
        </p>
        <RawBlock raw={state.raw} />
      </div>
    )
  }
  return children
}

function FullScreenIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  )
}

/** Every block a card header can name; an unreadable block draws UnknownBlock's card instead. */
type CardBlock = Exclude<StoredBlock, UnreadableBlock>

function captionLeaf(block: CardBlock): CardLeaf | undefined {
  switch (block.type) {
    case 'table':
    case 'compare':
    case 'stat':
    case 'coverage':
    case 'list':
    case 'image':
      return block.caption === undefined ? undefined : { text: block.caption, path: 'caption' }
    case 'code':
      return block.filename === undefined
        ? { text: block.language, path: 'language' }
        : { text: block.filename, path: 'filename' }
    case 'ba':
      return block.filename === undefined ? undefined : { text: block.filename, path: 'filename' }
    case 'walkthrough':
      if (block.filename !== undefined) return { text: block.filename, path: 'filename' }
      return block.title === undefined
        ? { text: block.language, path: 'language' }
        : { text: block.title, path: 'title' }
    case 'seq':
    case 'state':
    case 'layers':
    case 'erd':
    case 'mermaid':
    case 'math':
    case 'bigo':
    case 'heatmap':
    case 'histogram':
    case 'scatter':
    case 'plot3d':
      return block.title === undefined ? undefined : { text: block.title, path: 'title' }
    case 'note':
    case 'warn':
    case 'good':
    case 'details':
    case 'p':
    case 'diff':
    case 'trajectory':
      return undefined
    default: {
      const unhandled: never = block
      return unhandled
    }
  }
}

export function cardHeader(
  block: CardBlock,
  { sid, bid, pathPrefix = '', annotatable = true, onMarkClick }: BlockAnchor,
): Pick<BlockCardProps, 'kind' | 'caption' | 'sid' | 'bid' | 'annotatable' | 'onMarkClick'> {
  const leaf = captionLeaf(block)
  return {
    kind: block.type,
    caption: leaf && { text: leaf.text, path: `${pathPrefix}${leaf.path}` },
    sid,
    bid,
    annotatable,
    onMarkClick,
  }
}
