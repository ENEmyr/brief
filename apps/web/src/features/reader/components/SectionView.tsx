import type { Section } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockRenderer } from './BlockRenderer'

const pad = (n: number) => String(n).padStart(2, '0')

export function SectionView({
  section,
  sid,
  onMarkClick,
}: {
  section: Section
  sid: number
  onMarkClick?: (highlight: Highlight) => void
}) {
  return (
    <section id={section.id} data-section={section.id} className="mb-11 scroll-mt-[76px]">
      <h2 className="mb-3.5 border-b-2 border-mauvesoft pb-2 text-[21px] font-bold">
        <span className="mr-2 font-mono text-[16px] text-mauve">{pad(section.no)}</span>
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
      {section.blocks.map((b, i) => (
        <BlockRenderer key={i} block={b} sid={sid} bid={i} onMarkClick={onMarkClick} />
      ))}
    </section>
  )
}
