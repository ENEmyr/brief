import { DocumentPreview } from './DocumentPreview'
import { BLOCK_GROUPS, SKILL_DOCS_URL } from '../lib/content'
import { FOCUS_RING } from '../lib/styles'

export function BlockShowcase() {
  return (
    <section id="example" className="mx-auto max-w-[1080px] scroll-mt-16 px-6 py-16">
      <h2 className="text-[24px] font-semibold tracking-tight text-text">What it renders</h2>
      <p className="mt-2 max-w-[62ch] text-[15px] text-sub">
        Twenty-two block types and one decision card. Diagrams zoom and pan, code carries real
        syntax highlighting, and any line of text can be highlighted and turned into a prompt for
        the agent.
      </p>

      <div className="mt-8 grid items-start gap-10 min-[880px]:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] min-[880px]:gap-12">
        <DocumentPreview />

        <div>
          <dl className="divide-y divide-line border-y border-line">
            {BLOCK_GROUPS.map((group) => (
              <div key={group.name} className="py-4">
                <dt className="text-[14px] font-semibold text-text">{group.name}</dt>
                <dd className="mt-2">
                  <ul className="flex flex-wrap gap-1.5">
                    {group.blocks.map((block) => (
                      <li
                        key={block}
                        className="rounded-md bg-chip px-2 py-1 font-mono text-[11.5px] text-sub"
                      >
                        {block}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[13px] leading-relaxed text-sub">{group.note}</p>
                </dd>
              </div>
            ))}
          </dl>
          <a
            href={SKILL_DOCS_URL}
            className={`mt-4 inline-flex min-h-11 items-center text-[14px] text-mauve hover:underline ${FOCUS_RING}`}
          >
            Read the block reference
          </a>
        </div>
      </div>
    </section>
  )
}
