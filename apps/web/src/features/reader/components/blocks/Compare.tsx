import type { Block } from '@brief/schema'

export function Compare({ block }: { block: Extract<Block, { type: 'compare' }> }) {
  return (
    <figure className="my-4">
      <figcaption className="font-mono text-[10.5px] tracking-[.04em] text-faint mb-2">Comparison</figcaption>
      <div className="flex gap-3.5 items-stretch max-[879px]:flex-col">
        {[
          { side: 'left', data: block.left },
          { side: 'right', data: block.right },
        ].map(({ side, data }) => (
          <div
            key={side}
            className="flex-1 min-w-0 border border-line border-t-[3px] border-t-mauve rounded-xl bg-[var(--compare-pane-bg)] px-[17px] py-[15px]"
          >
            <div className="mb-[11px] text-[14.5px] font-bold text-text">{data.title}</div>
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
