'use client'
import { Toc } from '@/features/toc'
import { useSession } from '../hooks/useSession'
import { Skeleton } from './Skeleton'
import { MetaHeader } from './MetaHeader'
import { SectionView } from './SectionView'
import { Topbar } from './Topbar'

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <Topbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-line bg-card p-6 text-center text-sub shadow-[var(--shadow-card)]">
          {children}
        </div>
      </main>
    </div>
  )
}

export function SessionView({ id }: { id: string | null }) {
  const { status, data } = useSession(id)

  if (status === 'notfound') {
    return <StatusCard>Session not found or expired.</StatusCard>
  }

  if (status === 'error') {
    return (
      <StatusCard>
        <p className="mb-4">Something went wrong loading this session.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-surface0 px-4 py-2 font-medium text-text hover:bg-surface1"
        >
          Retry
        </button>
      </StatusCard>
    )
  }

  if (status !== 'ready' || !data) {
    return <Skeleton />
  }

  if (data.encrypted || !data.payload) {
    return (
      <StatusCard>
        Protected session - password unlock arrives in a later release.
      </StatusCard>
    )
  }

  return (
    <div className="min-h-screen">
      <Topbar sessionId={data.id} repo={data.payload.meta.repo} showProgress />
      <Toc
        sections={data.payload.sections.map((s) => ({ id: s.id, no: s.no, title: s.title }))}
      />
      <main className="mx-auto max-w-3xl px-4 py-8 lg:pl-16">
        <MetaHeader meta={data.payload.meta} sessionId={data.id} />
        {data.payload.sections.map((s) => (
          <SectionView key={s.id} section={s} />
        ))}
      </main>
    </div>
  )
}
