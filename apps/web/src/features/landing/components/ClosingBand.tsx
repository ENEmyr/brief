import { DOCS_URL } from '../lib/content'
import { BAND, FOCUS_RING, PAD } from '../lib/styles'
import { InstallCommand } from './InstallCommand'
import styles from './landing.module.css'

export function ClosingBand() {
  return (
    <section className={`border-t border-line ${BAND}`}>
      <div className={`mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-6 py-16 ${PAD}`}>
        <div className="flex max-w-[560px] flex-col gap-2">
          <h2 className="m-0 text-[32px] leading-[38px] font-semibold tracking-[-0.03em]">
            Give your agent a better way to ask.
          </h2>
          <span className="text-[16px] leading-[26px] text-sub">One command in the project your agent works in.</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <InstallCommand />
          <a
            href={DOCS_URL}
            className={`${styles.btn} flex min-h-[50px] items-center rounded-[6px] border border-line2 px-[18px] text-[15px] text-text no-underline ${FOCUS_RING}`}
          >
            Read the docs
          </a>
        </div>
      </div>
    </section>
  )
}
