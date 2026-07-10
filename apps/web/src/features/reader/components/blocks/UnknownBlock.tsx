function blockTypeLabel(block: unknown): string {
  if (block && typeof block === 'object' && 'type' in block && typeof (block as { type: unknown }).type === 'string') {
    return (block as { type: string }).type
  }
  return 'unknown'
}

export function UnknownBlock({ block }: { block: unknown }) {
  return (
    <figure className="my-4 border border-line rounded-xl bg-card overflow-hidden">
      <figcaption className="px-3.5 py-[9px] border-b border-line2 bg-elev font-mono text-[10.5px] tracking-[.04em] text-faint">
        {blockTypeLabel(block)}
      </figcaption>
      <pre className="overflow-x-auto p-4 text-xs text-sub font-mono">{JSON.stringify(block, null, 2)}</pre>
    </figure>
  )
}
