import { NAV_LINKS, REPO_URL } from '../lib/content'
import { FOCUS_RING, NARROW_TARGET, PAD } from '../lib/styles'

export function LogoTile({ size }: { size: 'header' | 'preview' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-[4px] bg-accent font-mono font-semibold text-on-accent ${
        size === 'header' ? 'h-[22px] w-[22px] text-[13px]' : 'h-5 w-5 text-[12px]'
      }`}
    >
      b
    </span>
  )
}

export function SiteHeader() {
  return (
    <header className={`mx-auto flex h-[60px] max-w-[1280px] items-center gap-5 border-b border-line ${PAD}`}>
      <span className="flex items-center gap-2 font-semibold">
        <LogoTile size="header" />
        brief
      </span>
      <nav aria-label="Primary" className="flex gap-5 text-[14px] max-[880px]:hidden">
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} className={`text-sub no-underline ${FOCUS_RING}`}>
            {link.label}
          </a>
        ))}
      </nav>
      <span className="grow" />
      <a
        href={REPO_URL}
        className={`rounded-[4px] border border-line2 px-3 py-[6px] text-[14px] text-text no-underline ${NARROW_TARGET} ${FOCUS_RING}`}
      >
        GitHub
      </a>
    </header>
  )
}
