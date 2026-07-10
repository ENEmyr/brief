import type { Section } from '@brief/schema'
import { BlockRenderer } from './BlockRenderer'

export function SectionView({ section }: { section: Section }) {
  return (
    <section id={section.id} data-section={section.id} className="mt-10 scroll-mt-20">
      <h2 className="mb-4 text-2xl font-semibold">
        {section.no}. {section.title}
      </h2>
      {section.blocks.map((b, i) => (
        <BlockRenderer key={i} block={b} />
      ))}
    </section>
  )
}
