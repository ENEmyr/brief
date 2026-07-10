import type { Block } from '@brief/schema'

type CalloutBlock = Extract<Block, { type: 'note' | 'warn' | 'good' }>

const styles = {
  note: 'border-blue bg-[var(--callout-note-bg)]',
  warn: 'border-peach bg-[var(--callout-warn-bg)]',
  good: 'border-green bg-[var(--callout-good-bg)]',
} as const

export function Callout({ block }: { block: CalloutBlock }) {
  return (
    <aside
      className={`border-l-[3px] rounded-lg px-[15px] py-[11px] my-3.5 text-[14px] leading-[1.7] text-text ${styles[block.type]}`}
    >
      {block.title ? <p className="mb-1 font-semibold">{block.title}</p> : null}
      <p>{block.text}</p>
    </aside>
  )
}
