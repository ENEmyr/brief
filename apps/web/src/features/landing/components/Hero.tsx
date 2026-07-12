import { CodePanel } from './CodePanel'
import { CopyCommand } from './CopyCommand'
import { INSTALL_COMMAND, PAYLOAD_SNIPPET, REPO_URL, RESPONSE_SNIPPET } from '../lib/content'
import { FOCUS_RING } from '../lib/styles'

/**
 * The hero states the exchange the product is: the payload on the right is the
 * whole input, the response under it is the whole output. Nothing else about
 * Brief is more characteristic than that, so it leads.
 */
export function Hero() {
  return (
    <section className="mx-auto grid max-w-[1080px] gap-12 px-6 pt-16 pb-20 min-[880px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] min-[880px]:items-center min-[880px]:gap-14 min-[880px]:pt-24">
      <div>
        <p className="font-mono text-[11px] tracking-[0.14em] text-mauve uppercase">
          POST /api/session
        </p>
        <h1 className="mt-4 text-[38px] leading-[1.12] font-semibold tracking-tight text-text min-[880px]:text-[46px]">
          Your agent writes the document.
          <br />
          You decide inside it.
        </h1>
        <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-sub">
          Brief turns an agent&apos;s work into an interactive decision document: sections,
          diagrams, charts, code, and the questions it needs you to answer. The agent sends one JSON
          payload and gets back one link. You read it, annotate it, answer it, and the agent picks
          your answers back up.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <CopyCommand command={INSTALL_COMMAND} />
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={REPO_URL}
              className={`flex min-h-11 items-center rounded-xl bg-mauve px-5 text-[14px] font-medium text-[var(--ctp-oncolor)] shadow-[var(--shadow-mauve-glow)] transition-opacity hover:opacity-90 ${FOCUS_RING}`}
            >
              View the source on GitHub
            </a>
            <a
              href="#example"
              className={`flex min-h-11 items-center rounded-xl border border-line px-5 text-[14px] text-text transition-colors hover:border-mauve ${FOCUS_RING}`}
            >
              See what it renders
            </a>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <CodePanel caption="what the agent sends" code={PAYLOAD_SNIPPET} language="json" />
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-card">
          <div className="border-b border-line2 bg-elev px-3.5 py-[9px]">
            <span className="font-mono text-[10.5px] tracking-wide text-faint uppercase">
              what it gets back
            </span>
          </div>
          <p className="px-4 py-3 font-mono text-[12.5px] break-words text-sub">
            {RESPONSE_SNIPPET}
          </p>
        </div>
      </div>
    </section>
  )
}
