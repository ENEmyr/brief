'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Payload } from '@brief/schema'
import { Toc } from '@/features/toc'
import type { TocSection } from '@/features/toc'
import { DiagramViewerProvider } from '@/features/diagram-viewer'
import { ReaderStateProvider, useReaderStateStore } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import { AskPopover, NotePopover, SelectionToolbar } from '@/features/annotations'
import { DecisionSection } from '@/features/decisions'
import { ExportProvider, useExport } from '@/features/export'
import { SaveModal, UnlockCard } from '@/features/save'
import type { SessionData } from '../services/api'
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

/**
 * The fully-loaded reader UI: Topbar, TOC, sections, decisions, and the
 * annotation popovers/toolbar. Split out from SessionView so it can render
 * inside both ReaderStateProvider and ExportProvider and call useExport()
 * for the Topbar's Markdown/Share buttons and the copy chain threaded into
 * SelectionToolbar/AskPopover (Task 6) -- useExport() only resolves to a
 * real value for descendants of ExportProvider, not for SessionView itself.
 */
function SessionReady({
  data,
  protectedSession,
}: {
  data: SessionData & { payload: NonNullable<SessionData['payload']> }
  /**
   * Set once the reader has decrypted a protected session's payload for this
   * page view (memory-only, re-locks on navigation/reload). Hides the Save
   * button entirely -- the envelope is already encrypted, so there is
   * nothing new to save -- and swaps the "saved" chip for a "protected" one.
   */
  protectedSession?: boolean
}) {
  const { copy, share, downloadMarkdown } = useExport()
  const [tocCollapsed, setTocCollapsed] = useState(false)
  // Drawer open state lives here per the Task 5 contract; `onMenu` from
  // Topbar opens it and Toc's onCloseDrawer prop closes it.
  const [tocDrawerOpen, setTocDrawerOpen] = useState(false)
  // Note/Ask popovers are mutually exclusive -- opening one always closes
  // the other, matching the prototype's single-notePop/single-askPop state.
  const [notePopId, setNotePopId] = useState<string | null>(null)
  const [askPopId, setAskPopId] = useState<string | null>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  // Local, display-only override -- deliberately NOT written back into `data`
  // (or anything the outer SessionView's `data.encrypted` render gate reads).
  // After an encrypt-save, SessionReady keeps rendering the CURRENT decrypted
  // payload already in memory; only the "saved" chip reflects the new status.
  // Mutating `data.encrypted` here would make the component fall through to
  // the "Protected session" placeholder on next render, which would
  // incorrectly blank a doc the reader is actively viewing.
  const [savedOverride, setSavedOverride] = useState(false)
  const saved = savedOverride || data.saved
  const savedLabel = protectedSession ? 'protected' : saved ? 'saved' : undefined

  // bug-250: an in-view encrypt save purges the server's plaintext state:<id>
  // KV blob (this ReaderStateProvider was mounted with persist=true, since
  // the session was NOT protected on load). Once that save lands, the store
  // must stop persisting/syncing for good -- otherwise the very next
  // highlight/note mutation PUTs plaintext right back to the unauthenticated
  // state endpoint the server just purged. The store stays in memory
  // (annotations already on screen are untouched); only future persistence
  // is disabled.
  const [encryptedNow, setEncryptedNow] = useState(false)
  const readerStateStore = useReaderStateStore()

  useEffect(() => {
    if (encryptedNow) readerStateStore.stopPersistence()
  }, [encryptedNow, readerStateStore])

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

  // Stable identities for the modal/popover dismiss handlers passed as props
  // to SaveModal/NotePopover/AskPopover (review finding).
  const closeSaveModal = useCallback(() => setSaveModalOpen(false), [])
  const closeNotePopover = useCallback(() => setNotePopId(null), [])
  const closeAskPopover = useCallback(() => setAskPopId(null), [])

  const sections = data.payload.sections.map((s) => ({ id: s.id, no: s.no, title: s.title }))
  const hasDecisions = data.payload.decisions.length > 0
  const tocSections: TocSection[] = hasDecisions
    ? [...sections, { id: 'decide', no: sections.length + 1, title: 'Decisions' }]
    : sections

  return (
    <div className="min-h-screen bg-page">
      <Topbar
        sessionId={data.id}
        repo={data.payload.meta.repo}
        showProgress
        savedLabel={savedLabel}
        onMenu={() => setTocDrawerOpen(true)}
        onSave={protectedSession ? undefined : () => setSaveModalOpen(true)}
        onDownload={downloadMarkdown}
        onShare={share}
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
                  docTitle={data.payload.meta.title}
                  sessionId={data.id}
                  copyText={copy}
                />
              )}
            </div>
          </div>
        </DiagramViewerProvider>
      </main>
      <SelectionToolbar onRequestNote={openNote} onRequestAsk={openAsk} copyText={copy} />
      {notePopId && <NotePopover id={notePopId} onClose={closeNotePopover} />}
      {askPopId && (
        <AskPopover
          id={askPopId}
          sections={data.payload.sections}
          sessionId={data.id}
          docTitle={data.payload.meta.title}
          onClose={closeAskPopover}
          copyText={copy}
        />
      )}
      {!protectedSession && saveModalOpen && (
        <SaveModal
          sessionId={data.id}
          payload={data.payload}
          onClose={closeSaveModal}
          onSaved={(mode) => {
            setSavedOverride(true)
            if (mode === 'encrypt') setEncryptedNow(true)
          }}
          // A save the user cancelled mid-flight can still commit server-side
          // (the PUT cannot be recalled). No toast/modal feedback in that
          // case, but the chip must still reflect server truth.
          onBackgroundSaveSettled={(mode) => {
            setSavedOverride(true)
            if (mode === 'encrypt') setEncryptedNow(true)
          }}
        />
      )}
    </div>
  )
}

export function SessionView({ id }: { id: string | null }) {
  const { status, data } = useSession(id)
  // Memory-only: never written to sessionStorage/localStorage/IndexedDB.
  // Losing this state (reload, navigating away) re-locks the session, which
  // is the intended behavior for a zero-knowledge protected doc.
  const [decrypted, setDecrypted] = useState<Payload | null>(null)

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

  if (data.encrypted) {
    if (decrypted) {
      return (
        // Reader state for protected sessions is memory-only: the KV state
        // endpoint is unauthenticated and payload-derived text must never
        // leave the device unencrypted. Same-key encrypted sync is a
        // roadmap enhancement.
        <ReaderStateProvider key={data.id} sessionId={data.id} persist={false}>
          <ExportProvider sessionId={data.id} payload={decrypted}>
            <SessionReady data={{ ...data, payload: decrypted }} protectedSession />
          </ExportProvider>
        </ReaderStateProvider>
      )
    }
    if (!data.encParams) {
      return <StatusCard>Protected session data is corrupted.</StatusCard>
    }
    return (
      <StatusCard>
        <UnlockCard ciphertext={data.raw} encParams={data.encParams} onUnlock={setDecrypted} />
      </StatusCard>
    )
  }

  if (!data.payload) {
    return <StatusCard>Something went wrong loading this session.</StatusCard>
  }

  return (
    <ReaderStateProvider key={data.id} sessionId={data.id}>
      <ExportProvider sessionId={data.id} payload={data.payload}>
        <SessionReady data={{ ...data, payload: data.payload }} />
      </ExportProvider>
    </ReaderStateProvider>
  )
}
