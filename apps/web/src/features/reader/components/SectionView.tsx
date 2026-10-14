import type { Block, Section } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockRenderer } from './BlockRenderer'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * One section as a B-Reader card: a header row (number and title) over the
 * blocks. `flash` replays the section flash after a jump; its parity picks one
 * of two identical animations so a second jump to the same section restarts
 * it. `only` keeps just those block types (the Diagrams view); kept blocks
 * keep their payload index, so highlights still anchor.
 */
export function SectionView({
  section,
  sid,
  onMarkClick,
  flash,
  only,
}: {
  section: Section
  sid: number
  onMarkClick?: (highlight: Highlight) => void
  flash?: number
  only?: ReadonlySet<Block['type']>
}) {
  return (
    <section
      id={section.id}
      data-section={section.id}
      data-flash={flash === undefined ? undefined : flash % 2 === 0 ? 'a' : 'b'}
      className="scroll-mt-[72px] rounded-[6px] border border-line bg-card"
    >
      <div className="flex items-center gap-[10px] border-b border-line px-4 py-3 leading-[normal]">
        <span className="font-mono text-[12px] text-accent-text">{pad(section.no)}</span>
        <h2 className="m-0 text-[18px] font-semibold leading-[26px] max-[880px]:text-[20px] max-[880px]:leading-7">
          {/* The heading is not a block, so it has no block index. It anchors at
              bid null rather than borrowing a sentinel index that would collide
              with a real block. */}
          <Annotatable
            text={section.title}
            sid={sid}
            bid={null}
            path="title"
            onMarkClick={onMarkClick}
          />
        </h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {section.blocks.map((b, i) =>
          only && !only.has(b.type) ? null : (
            <BlockRenderer key={i} block={b} sid={sid} bid={i} onMarkClick={onMarkClick} />
          ),
        )}
      </div>
    </section>
  )
}
