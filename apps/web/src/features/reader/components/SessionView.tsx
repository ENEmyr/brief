'use client'
import { ThemeToggle } from '@/features/theme'
import { Toc } from '@/features/toc'
import { useSession } from '../hooks/useSession'
import { Skeleton } from './Skeleton'
import { MetaHeader } from './MetaHeader'
import { SectionView } from './SectionView'

function StatusHeader({ hasToc = false }: { hasToc?: boolean }) {
  return (
    <header
      className={`sticky top-0 z-10 flex h-14 items-center justify-between border-b border-surface0 bg-base/90 pr-4 backdrop-blur ${hasToc ? 'pl-16 lg:pl-4' : 'pl-4'}`}
    >
      <span className="font-semibold">Brief</span>
      <ThemeToggle />
    </header>
  )
}

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <StatusHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-lg border border-surface0 bg-mantle p-6 text-center text-subtext0">
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
      <StatusHeader hasToc />
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
