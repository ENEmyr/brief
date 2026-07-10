'use client'
import { useEffect, useState } from 'react'
import { Toc } from '@/features/toc'
import { DiagramViewerProvider } from '@/features/diagram-viewer'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import { AskPopover, NotePopover, SelectionToolbar } from '@/features/annotations'
import { DecisionSection } from '@/features/decisions'
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
  // Note/Ask popovers are mutually exclusive -- opening one always closes
  // the other, matching the prototype's single-notePop/single-askPop state.
  const [notePopId, setNotePopId] = useState<string | null>(null)
  const [askPopId, setAskPopId] = useState<string | null>(null)

  useEffect(() => {
    setTocCollapsed(readStoredTocCollapsed())
  }, [])

  function openNote(id: string) {
    setAskPopId(null)
    setNotePopId(id)
  }

  function openAsk(id: string) {
    setNotePopId(null)
    setAskPopId(id)
  }

  function handleMarkClick(highlight: Highlight) {
    // Any non-ask mark (plain highlight or note) opens NotePopover; an ask
    // mark (question !== undefined) opens AskPopover -- matches the
    // prototype's prose() onClick (Reader.dc.html line 572).
    if (highlight.question !== undefined) openAsk(highlight.id)
    else openNote(highlight.id)
  }

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
  const hasDecisions = data.payload.decisions.length > 0
  const tocSections = hasDecisions
    ? [...sections, { id: 'decide', no: sections.length + 1, title: 'Decisions' }]
    : sections

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
                sections={tocSections}
                collapsed={tocCollapsed}
                onToggleCollapsed={toggleTocCollapsed}
                drawerOpen={tocDrawerOpen}
                onCloseDrawer={() => setTocDrawerOpen(false)}
              />
              <div>
                {data.payload.sections.map((s, si) => (
                  <SectionView key={s.id} section={s} sid={si} onMarkClick={handleMarkClick} />
                ))}
                {hasDecisions && (
                  <DecisionSection
                    decisions={data.payload.decisions}
                    no={data.payload.sections.length + 1}
                  />
                )}
              </div>
            </div>
          </DiagramViewerProvider>
        </main>
        <SelectionToolbar onRequestNote={openNote} onRequestAsk={openAsk} />
        {notePopId && <NotePopover id={notePopId} onClose={() => setNotePopId(null)} />}
        {askPopId && (
          <AskPopover
            id={askPopId}
            sections={data.payload.sections}
            sessionId={data.id}
            docTitle={data.payload.meta.title}
            onClose={() => setAskPopId(null)}
          />
        )}
      </div>
    </ReaderStateProvider>
  )
}
