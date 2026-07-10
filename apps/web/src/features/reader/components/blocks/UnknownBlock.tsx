export function UnknownBlock({ block }: { block: unknown }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-lg bg-mantle p-4 text-xs text-subtext0">
      {JSON.stringify(block, null, 2)}
    </pre>
  )
}
