import { FOCUS_RING, PAD, PILL_BORDER } from '../lib/styles'
import { InstallCommand } from './InstallCommand'
import { Triptych } from './Triptych'
import styles from './landing.module.css'

export function Hero() {
  return (
    <section className={`mx-auto flex max-w-[1280px] flex-col gap-12 pt-20 pb-16 ${PAD}`}>
      <div className="flex max-w-[860px] flex-col gap-6">
        <span
          className={`${styles.rise} self-start rounded-[999px] border bg-accent-soft px-[10px] py-1 font-mono text-[12px] text-accent-text ${PILL_BORDER}`}
        >
          POST /api/session → one link
        </span>
        <h1
          className={`${styles.rise} ${styles.d1} m-0 text-[68px] leading-[70px] font-semibold tracking-[-0.04em] max-[880px]:text-[40px] max-[880px]:leading-[44px]`}
        >
          Your agent writes the document. You decide inside it.
        </h1>
        <p className={`${styles.rise} ${styles.d2} m-0 max-w-[640px] text-[18px] leading-[29px] text-sub`}>
          Brief turns an agent&apos;s work into an interactive decision document: sections, diagrams, charts,
          code, and the questions it needs you to answer. The agent sends one JSON payload and gets back one link.
        </p>
        <div className={`${styles.rise} ${styles.d3} flex flex-wrap items-center gap-3`}>
          <InstallCommand />
          <a
            href="#preview"
            className={`${styles.btn} flex min-h-12 items-center rounded-[6px] bg-accent px-[18px] text-[15px] font-semibold text-on-accent no-underline ${FOCUS_RING}`}
          >
            See what it renders
          </a>
        </div>
      </div>
      <Triptych className={`${styles.rise} ${styles.d3}`} />
    </section>
  )
}
