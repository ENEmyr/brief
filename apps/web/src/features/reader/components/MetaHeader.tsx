import type { Meta } from '@brief/schema'

const CHIP = 'rounded-[3px] border border-line2 px-[6px] py-[2px]'

function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * B-Reader's header card: the meta chips (doc id, author, role, date,
 * version, repo, read time), the title and the summary. The repo chip is a
 * link when it holds a web URL (owner ruling D5).
 */
export function MetaHeader({ meta }: { meta: Meta }) {
  const chips: React.ReactNode[] = []
  for (const [key, value] of [
    ['docId', meta.docId],
    ['author', meta.author],
    ['role', meta.author ? meta.role : undefined],
    ['date', meta.date],
    ['version', meta.version],
  ] as const) {
    if (value) chips.push(<span key={key} className={CHIP}>{value}</span>)
  }
  if (meta.repo) {
    chips.push(
      isWebUrl(meta.repo) ? (
        <a
          key="repo"
          href={meta.repo}
          target="_blank"
          rel="noopener noreferrer"
          className={`${CHIP} text-sub no-underline transition-colors duration-[var(--dur-fast)] hover:text-text`}
        >
          {meta.repo}
        </a>
      ) : (
        <span key="repo" className={CHIP}>
          {meta.repo}
        </span>
      ),
    )
  }
  if (meta.readTime) chips.push(<span key="readtime" className={CHIP}>{meta.readTime}</span>)

  return (
    <div className="console-rise flex flex-col gap-[14px] rounded-[6px] border border-line bg-card p-5 leading-[normal]">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-[6px] font-mono text-[11px] text-sub">{chips}</div>
      )}
      <h1 className="m-0 text-[30px] font-semibold leading-9 tracking-[-0.02em] max-[880px]:text-[24px] max-[880px]:leading-[30px]">
        {meta.title}
      </h1>
      {meta.subtitle && <p className="m-0 text-[15px] leading-[26px] text-sub">{meta.subtitle}</p>}
    </div>
  )
}
