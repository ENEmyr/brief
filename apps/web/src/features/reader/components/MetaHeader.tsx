import type { Meta } from '@brief/schema'

function Dot() {
  return <span className="mx-2 text-faint">·</span>
}

export function MetaHeader({ meta }: { meta: Meta }) {
  const items: React.ReactNode[] = []

  if (meta.author) {
    items.push(
      <span key="author" className="inline-flex items-center">
        <span className="mr-[7px] inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-mauve text-[11px] font-semibold text-white">
          {meta.author.charAt(0)}
        </span>
        <span className="font-semibold text-text">{meta.author}</span>
        {meta.role && <span className="text-faint"> · {meta.role}</span>}
      </span>,
    )
  }
  if (meta.date) {
    items.push(<span key="date">{meta.date}</span>)
  }
  if (meta.version) {
    items.push(
      <span key="version" className="font-mono">
        {meta.version}
      </span>,
    )
  }
  if (meta.repo) {
    items.push(
      <a
        key="repo"
        href={meta.repo}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-blue no-underline"
      >
        ⎇ {meta.repo}
      </a>,
    )
  }
  if (meta.readTime) {
    items.push(<span key="readtime">{meta.readTime}</span>)
  }

  return (
    <div className="mb-[26px] border-b border-line pt-[30px] pb-[22px]">
      {meta.docId && (
        <div className="mb-[9px] font-mono text-[11px] font-semibold tracking-[.12em] text-mauve">
          {meta.docId}
        </div>
      )}
      <h1 className="mb-2 text-[26px] font-bold leading-[1.25] min-[880px]:text-[32px]">
        {meta.title}
      </h1>
      {meta.subtitle && <p className="mb-4 max-w-[640px] text-[15px] text-sub">{meta.subtitle}</p>}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center text-[12.5px] text-sub">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center">
              {i > 0 && <Dot />}
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
