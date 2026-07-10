'use client'
import { useEffect, useState } from 'react'
import { Toc } from '@/features/toc'
import { DiagramViewerProvider } from '@/features/diagram-viewer'
import { ReaderStateProvider } from '@/features/reader-state'
import { SelectionToolbar } from '@/features/annotations'
import { useSession } from '../hooks/useSession'
import { Skeleton } from './Skeleton'
import { MetaHeader } from './MetaHeader'
import { SectionView } from './SectionView'
import { Topbar } from './Topbar'

const TOC_STORAGE_KEY = 'idocs:toc'

function readStoredTocCollapsed(): boolean {
  try {
    return localStorage.getItem(TOC_STORAGE_KEY) === 'collapsed'
  } catch {
    return false
  }
}

function storeTocCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(TOC_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded')
  } catch {
    // private mode: collapse state just does not persist
  }
}

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
  const [tocCollapsed, setTocCollapsed] = useState(false)
  // Drawer open state lives here per the Task 5 contract; `onMenu` from
  // Topbar opens it and Toc's onCloseDrawer prop closes it.
  const [tocDrawerOpen, setTocDrawerOpen] = useState(false)

  useEffect(() => {
    setTocCollapsed(readStoredTocCollapsed())
  }, [])

  function toggleTocCollapsed() {
    setTocCollapsed((prev) => {
      const next = !prev
      storeTocCollapsed(next)
      return next
    })
  }

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
          className="rounded-lg border border-line bg-elev px-4 py-2 font-medium text-text hover:bg-chip"
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
    return <StatusCard>Protected session - password unlock arrives in a later release.</StatusCard>
  }

  const sections = data.payload.sections.map((s) => ({ id: s.id, no: s.no, title: s.title }))

  return (
    <ReaderStateProvider key={data.id} sessionId={data.id}>
      <div className="min-h-screen bg-page">
        <Topbar
          sessionId={data.id}
          repo={data.payload.meta.repo}
          showProgress
          onMenu={() => setTocDrawerOpen(true)}
        />
        <main className="mx-auto max-w-[1180px] px-4 pb-[90px] min-[880px]:px-7 min-[880px]:pb-[110px]">
          <MetaHeader meta={data.payload.meta} />
          <DiagramViewerProvider>
            <div
              className="items-start gap-[34px] min-[880px]:grid"
              style={{ gridTemplateColumns: tocCollapsed ? '48px 1fr' : '188px 1fr' }}
            >
              <Toc
                sections={sections}
                collapsed={tocCollapsed}
                onToggleCollapsed={toggleTocCollapsed}
                drawerOpen={tocDrawerOpen}
                onCloseDrawer={() => setTocDrawerOpen(false)}
              />
              <div>
                {data.payload.sections.map((s, si) => (
                  <SectionView key={s.id} section={s} sid={si} />
                ))}
              </div>
            </div>
          </DiagramViewerProvider>
        </main>
        {/* Highlight/Note/Ask/Copy actions are wired to the store now; Note
            and Ask popovers themselves arrive in Task 3, so those two
            callbacks are no-ops here for the moment. */}
        <SelectionToolbar onRequestNote={() => {}} onRequestAsk={() => {}} />
      </div>
    </ReaderStateProvider>
  )
}
