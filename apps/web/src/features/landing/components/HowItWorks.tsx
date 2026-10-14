import { STEPS } from '../lib/content'
import { BAND, H2, PAD } from '../lib/styles'

/** Three steps, in the order the round trip really happens (B-Landing:86-95). */
export function HowItWorks() {
  return (
    <section id="how" className={`border-y border-line ${BAND}`}>
      <div className={`mx-auto flex max-w-[1280px] flex-col gap-8 py-[72px] ${PAD}`}>
        <h2 className={H2}>How it works</h2>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4 p-0">
          {STEPS.map((step) => (
            <li key={step.label} className="flex flex-col gap-[10px] rounded-[6px] border border-line bg-card p-5">
              <span className="font-mono text-[12px] text-accent-text">{step.label}</span>
              <h3 className="m-0 text-[19px] leading-[26px] font-semibold">{step.title}</h3>
              <p className="m-0 text-[15px] leading-6 text-sub">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
