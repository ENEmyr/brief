import { BLOCK_GROUPS, SKILL_DOCS_URL } from '../lib/content'
import { FOCUS_RING, H2, LINK, NARROW_TARGET, PAD } from '../lib/styles'

const CELL = 'px-4 py-[14px]'

export function BlockTable() {
  return (
    <section id="blocks" className={`mx-auto flex max-w-[1280px] flex-col gap-6 py-[72px] ${PAD}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className={H2}>Blocks</h2>
        <a href={SKILL_DOCS_URL} className={`font-mono text-[13px] underline ${LINK} ${NARROW_TARGET} ${FOCUS_RING}`}>
          BLOCKS.md
        </a>
      </div>
      <div className="overflow-x-auto rounded-[6px] border border-line">
        <table className="w-full min-w-[640px] border-collapse text-[14px] leading-[22px]">
          <tbody>
            {BLOCK_GROUPS.map((group, i) => (
              <tr key={group.name} className={i > 0 ? 'border-t border-line' : undefined}>
                <th scope="row" className={`${CELL} text-left font-semibold ${i === 0 ? 'w-[232px]' : ''}`}>
                  {group.name}
                </th>
                <td className={`${CELL} font-mono text-[12px] text-accent-text ${i === 0 ? 'w-[332px]' : ''}`}>
                  {group.blocks.join(' ')}
                </td>
                <td className={`${CELL} text-sub`}>{group.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
