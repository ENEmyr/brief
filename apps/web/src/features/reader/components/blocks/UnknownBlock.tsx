import { BlockCard } from '../BlockCard'

function blockTypeLabel(block: unknown): string {
  if (block && typeof block === 'object' && 'type' in block && typeof (block as { type: unknown }).type === 'string') {
    return (block as { type: string }).type
  }
  return 'unknown'
}

export function UnknownBlock({ block }: { block: unknown }) {
  return <BlockCard kind={blockTypeLabel(block)} state={{ status: 'unsupported', raw: block }} />
}
