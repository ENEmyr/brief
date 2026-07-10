import type { Section } from '@brief/schema'
import { BlockRenderer } from './BlockRenderer'

const pad = (n: number) => String(n).padStart(2, '0')

export function SectionView({ section, sid }: { section: Section; sid: number }) {
  return (
    <section id={section.id} data-section={section.id} className="mb-11 scroll-mt-[76px]">
      <h2 className="mb-3.5 border-b-2 border-mauvesoft pb-2 text-[21px] font-bold">
        <span className="mr-2 font-mono text-[16px] text-mauve">{pad(section.no)}</span>
        {section.title}
      </h2>
      {section.blocks.map((b, i) => (
        <BlockRenderer key={i} block={b} sid={sid} bid={i} />
      ))}
    </section>
  )
}
