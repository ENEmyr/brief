import { highlight } from '../lib/highlight'

/**
 * The reader's code chrome (elev header bar, dark code surface, rounded card)
 * rebuilt for static snippets. It reuses the shape, not the CodeBlock
 * component, because CodeBlock is an annotatable leaf tied to a payload path
 * and drags Shiki in behind it.
 */
export function CodePanel({
  caption,
  code,
  language,
}: {
  caption: string
  code: string
  language: 'json' | 'shell'
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line2 bg-elev px-3.5 py-[9px]">
        <span className="font-mono text-[10.5px] tracking-wide text-faint uppercase">{caption}</span>
      </div>
      <pre className="overflow-x-auto bg-[var(--code-bg)] p-4 font-mono text-[12.5px] leading-[1.65] text-[#cdd6f4]">
        <code>{highlight(code, language)}</code>
      </pre>
    </div>
  )
}
