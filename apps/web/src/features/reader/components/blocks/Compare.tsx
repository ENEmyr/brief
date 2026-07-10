import type { Block } from '@brief/schema'

const paneBorderTop = {
  good: 'border-t-green',
  bad: 'border-t-red',
} as const

const paneBg = {
  good: 'bg-[var(--compare-pane-good-bg)]',
  bad: 'bg-[var(--compare-pane-bad-bg)]',
} as const

const tagPillTone = {
  good: 'text-green border-green',
  bad: 'text-red border-red',
} as const

export function Compare({ block }: { block: Extract<Block, { type: 'compare' }> }) {
  return (
    <figure className="my-4">
      <figcaption className="font-mono text-[10.5px] tracking-[.04em] text-faint mb-2">
        {block.caption ?? 'Comparison'}
      </figcaption>
      <div className="flex gap-3.5 items-stretch max-[879px]:flex-col">
        {[
          { side: 'left', data: block.left },
          { side: 'right', data: block.right },
        ].map(({ side, data }) => (
          <div
            key={side}
            className={`flex-1 min-w-0 border border-line border-t-[3px] ${data.tone ? paneBorderTop[data.tone] : 'border-t-mauve'} rounded-xl ${data.tone ? paneBg[data.tone] : 'bg-[var(--compare-pane-bg)]'} px-[17px] py-[15px]`}
          >
            <div className="flex items-center gap-2 mb-[11px]">
              <div className="text-[14.5px] font-bold text-text">{data.title}</div>
              {data.tag && (
                <span
                  className={`font-mono text-[10.5px] font-semibold rounded-full px-2.5 py-0.5 border bg-[var(--compare-tag-bg)] ${data.tone ? tagPillTone[data.tone] : 'text-mauve border-mauve'}`}
                >
                  {data.tag}
                </span>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {data.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-[1.55] text-text">
                  <span className={`flex-none font-bold ${item.ok ? 'text-green' : 'text-red'}`}>
                    {item.ok ? '✓' : '✕'}
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </figure>
  )
}
