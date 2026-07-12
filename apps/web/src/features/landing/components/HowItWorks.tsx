import { STEPS } from '../lib/content'

/**
 * The steps are numbered because the round trip really is ordered: the link
 * cannot exist before the payload, and the answers cannot exist before the
 * link. The number chips borrow the reader's own section numbering, so the
 * page reads like the thing it describes.
 */
export function HowItWorks() {
  return (
    <section className="border-y border-line bg-elev">
      <div className="mx-auto max-w-[1080px] px-6 py-16">
        <h2 className="text-[24px] font-semibold tracking-tight text-text">The round trip</h2>
        <p className="mt-2 max-w-[60ch] text-[15px] text-sub">
          Three moves. The agent never asks you to scroll a wall of chat, and you never re-explain a
          decision you already made.
        </p>

        <ol className="mt-8 grid gap-4 min-[880px]:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.no} className="rounded-xl border border-line bg-card p-5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-mauvesoft font-mono text-[13px] font-semibold text-mauve">
                {step.no}
              </span>
              <h3 className="mt-3 text-[16px] font-semibold text-text">{step.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-sub">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
