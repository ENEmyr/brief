/**
 * Fixed copy only, never an error's own text, so no message, stack or path
 * reaches the reader. A block that can fail adds its own line here.
 */
export type BlockErrorMessage =
  | 'This block could not be drawn.'
  | `Diagram could not be drawn. Parse error on line ${number}.`
  | `Math could not be drawn. Parse error on line ${number}.`
  | 'Diagram could not be drawn.'
  | 'Chart could not be drawn.'
  | 'WebGL unavailable - 3D plot cannot render'
  | 'No data for 3D plot'

export interface BlockErrorProps {
  message: BlockErrorMessage
  source?: string
  /** 1-based, as parsers report it. */
  lineNumber?: number
}

export function BlockError({ message, source, lineNumber }: BlockErrorProps) {
  return (
    <>
      <div
        role="alert"
        className="rounded-[4px] border border-l-[3px] border-bad-line border-l-bad bg-bad-soft px-2.5 py-2 text-[13px] leading-5"
      >
        {message}
      </div>
      {source === undefined ? null : <SourceListing source={source} lineNumber={lineNumber} />}
    </>
  )
}

export function SourceListing({ source, lineNumber }: { source: string; lineNumber?: number }) {
  const lines = source.split('\n')
  const width = String(lines.length).length
  return (
    <pre className="m-0 overflow-x-auto rounded-[4px] bg-[var(--c-code-bg)] px-2.5 py-2 font-mono text-[11px] leading-[17px] text-sub">
      {lines.map((text, i) => {
        const numbered = `${String(i + 1).padEnd(width)}  ${text}`
        const end = i === lines.length - 1 ? '' : '\n'
        return i + 1 === lineNumber ? (
          <span key={i}>
            <span data-bad-line className="bg-bad-soft text-bad">
              {numbered}
            </span>
            {end}
          </span>
        ) : (
          <span key={i}>{numbered + end}</span>
        )
      })}
    </pre>
  )
}

export function RawBlock({ raw }: { raw: unknown }) {
  return (
    <details className="rounded-[4px] border border-line">
      <summary className="flex min-h-9 cursor-pointer items-center px-2.5 text-[12px] text-text max-[880px]:min-h-11">
        Show raw block
      </summary>
      <pre className="m-0 overflow-x-auto px-2.5 py-2 font-mono text-[11px] text-sub">
        {JSON.stringify(raw, null, 2)}
      </pre>
    </details>
  )
}
