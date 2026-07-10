import type { Meta } from '@brief/schema'

export function MetaHeader({ meta, sessionId }: { meta: Meta; sessionId: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold">{meta.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-subtext0">
        {meta.author && <span>{meta.author}</span>}
        {meta.date && <span>{meta.date}</span>}
        {meta.version && <span>v{meta.version}</span>}
        {meta.repo && (
          <a href={meta.repo} target="_blank" rel="noopener noreferrer" className="underline">
            Repo
          </a>
        )}
        <code>{sessionId}</code>
        {meta.readTime && <span>{meta.readTime}</span>}
      </div>
    </div>
  )
}
