import { DOCS_URL, REPO_URL } from '../lib/content'
import { FOCUS_RING, LINK, PAD } from '../lib/styles'

export function SiteFooter() {
  return (
    <footer
      className={`mx-auto flex max-w-[1280px] flex-wrap items-center gap-5 border-t border-line py-7 text-[13px] text-sub ${PAD}`}
    >
      <span className="font-semibold text-text">brief</span>
      <span>MIT licensed</span>
      <span className="grow" />
      <a href={REPO_URL} className={`no-underline ${LINK} ${FOCUS_RING}`}>
        GitHub
      </a>
      <a href={DOCS_URL} className={`no-underline ${LINK} ${FOCUS_RING}`}>
        Docs
      </a>
    </footer>
  )
}
