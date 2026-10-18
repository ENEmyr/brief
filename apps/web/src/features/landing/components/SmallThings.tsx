import { SMALL_THINGS } from '../lib/content'
import { H2, PAD } from '../lib/styles'

export function SmallThings() {
  return (
    <section id="features" className="border-t border-line">
      <div className={`mx-auto flex max-w-[1280px] flex-col gap-6 py-[72px] ${PAD}`}>
        <h2 className={H2}>Small things that add up</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-px overflow-hidden rounded-[6px] border border-line bg-line">
          {SMALL_THINGS.map((thing) => (
            <div key={thing.tag} className="flex flex-col gap-2 bg-page p-5">
              <span className="font-mono text-[12px] text-accent-text">{thing.tag}</span>
              <span className="text-[15px] leading-6 text-sub">{thing.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
