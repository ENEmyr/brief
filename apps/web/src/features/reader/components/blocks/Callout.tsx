import type { Block } from '@brief/schema'

type CalloutBlock = Extract<Block, { type: 'note' | 'warn' | 'good' }>

const styles = {
  note: 'border-blue bg-blue/10',
  warn: 'border-yellow bg-yellow/10',
  good: 'border-green bg-green/10',
} as const

export function Callout({ block }: { block: CalloutBlock }) {
  return (
    <aside className={`my-4 rounded-r-lg border-l-4 p-4 ${styles[block.type]}`}>
      {block.title ? <p className="mb-1 font-semibold">{block.title}</p> : null}
      <p className="text-subtext1">{block.text}</p>
    </aside>
  )
}
