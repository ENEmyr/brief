/** The Raw view: the payload's markdown export (the text /raw serves), as plain text. */
export function RawView({ markdown }: { markdown: string }) {
  return (
    <div className="rounded-[6px] border border-line bg-card">
      <pre
        aria-label="Raw markdown"
        className="m-0 overflow-x-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-5 text-text"
      >
        {markdown}
      </pre>
    </div>
  )
}
