import { ThemeToggle } from '@/features/theme'
import { REPO_URL } from '../lib/content'
import { FOCUS_RING } from '../lib/styles'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-page/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1080px] items-center gap-4 px-6 py-3">
        <span className="font-mono text-[15px] font-semibold tracking-tight text-text">brief</span>
        <span aria-hidden="true" className="font-mono text-[13px] text-faint">
          /s/&lt;id&gt;
        </span>
        <nav className="ml-auto flex items-center gap-1">
          <a
            href={REPO_URL}
            className={`flex min-h-11 items-center rounded-lg px-3 text-[14px] text-sub transition-colors hover:text-mauve ${FOCUS_RING}`}
          >
            GitHub
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
