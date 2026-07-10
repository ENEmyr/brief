import type { Section } from '@brief/schema'
import { BlockRenderer } from './BlockRenderer'

export function SectionView({ section }: { section: Section }) {
  return (
    <section id={section.id} data-section={section.id} className="mb-11 scroll-mt-[76px]">
      <h2 className="mb-3.5 border-b-2 border-mauvesoft pb-2 text-[21px] font-bold">
        <span className="mr-2 font-mono text-[16px] text-mauve">{section.no}</span>
        {section.title}
      </h2>
      {section.blocks.map((b, i) => (
        <BlockRenderer key={i} block={b} />
      ))}
    </section>
  )
}
