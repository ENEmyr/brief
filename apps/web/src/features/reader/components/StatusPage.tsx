import type { ReactNode } from 'react'

/** The mono first line of a status page, in its status color with its glyph (B-States:48,59,70). */
export interface StatusLine {
  tone: 'plain' | 'failed' | 'locked'
  text: string
}

const LINE: Record<StatusLine['tone'], { color: string; glyph: ReactNode }> = {
  plain: { color: 'text-faint', glyph: null },
  failed: { color: 'text-bad', glyph: <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-bad" /> },
  locked: {
    color: 'text-warn',
    glyph: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
  },
}

/** The status page's one primary action, a link or a button (B-States:51,62). */
export const STATUS_ACTION =
  'inline-flex min-h-9 cursor-pointer items-center rounded-ctrl border-0 bg-accent px-[14px] text-[13px] font-semibold text-on-accent no-underline transition-transform duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none max-[880px]:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

/** A page-level state (B-States: not found, load error, corrupt protected doc). */
export function StatusPage({
  line,
  title,
  help,
  action,
}: {
  line: StatusLine
  title: string
  help?: string
  action?: ReactNode
}) {
  const { color, glyph } = LINE[line.tone]
  return (
    <main className="flex min-h-screen items-center justify-center bg-page p-5 leading-[normal] text-text">
      <div role={line.tone === 'plain' ? undefined : 'alert'} className="flex w-[360px] max-w-full flex-col gap-[10px]">
        <span className={`flex items-center gap-[6px] font-mono text-[12px] ${color}`}>
          {glyph}
          {line.text}
        </span>
        <h1 className="m-0 text-[18px] font-semibold leading-6">{title}</h1>
        {help && <p className="m-0 text-[13px] leading-5 text-sub">{help}</p>}
        {action && <div className="mt-[6px] flex gap-2">{action}</div>}
      </div>
    </main>
  )
}

export function HomeLink() {
  return (
    <a href="/" className={STATUS_ACTION}>
      Go to brief home
    </a>
  )
}
