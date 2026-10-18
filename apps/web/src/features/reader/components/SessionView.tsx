'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { payloadToMarkdown } from '@brief/schema'
import type { StoredPayload } from '@brief/schema'
import { Toc, useActiveSection } from '@/features/toc'
import type { TocMark } from '@/features/toc'
import { DiagramViewerProvider } from '@/features/diagram-viewer'
import {
  ReaderStateProvider,
  useReaderState,
  useReaderStateStore,
  useSaveStatus,
} from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import { AskPopover, NotePopover, SelectionToolbar } from '@/features/annotations'
import {
  DecisionDock,
  DecisionSheet,
  PromptReviewSheet,
  ResetAnswers,
  buildReplyPrompt,
  isAnswered,
  nextOpenDecision,
  resolveRefs,
} from '@/features/decisions'
import type { DockTarget } from '@/features/decisions'
import { flagPromptLines } from '@/features/trajectory'
import { ExportProvider, useExport } from '@/features/export'
import { GlossaryProvider } from '@/features/glossary'
import { SaveModal, UnlockCard } from '@/features/save'
import { ImageKeyContext } from './blocks/ImageBlock'
import { CommandPalette, buildDocumentEntries } from '@/features/palette'
import type { PaletteEntry } from '@/features/palette'
import { ShortcutSheet, modKeyLabel, useShortcuts } from '@/features/shortcuts'
import { useTheme } from '@/features/theme'
import type { SessionData } from '../services/api'
import { useSession } from '../hooks/useSession'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { DIAGRAM_BLOCK_TYPES, hasDiagrams } from '../lib/views'
import type { ReaderView } from '../lib/views'
import { adjacentSectionId, findSection, scrollToElement } from '../lib/sectionNav'
import { BackPill } from './BackPill'
import type { BackTarget } from './BackPill'
import { DockSlot } from './DockSlot'
import { RawView } from './RawView'
import { Skeleton } from './Skeleton'
import { HomeLink, STATUS_ACTION, StatusPage } from './StatusPage'
import { NoDecisionsNote } from './NoDecisionsNote'
import { collectDiffNodeStatus, DiffNodeStatusContext } from './blocks/diffNodeStatus'
import { MetaHeader } from './MetaHeader'
import { SectionView } from './SectionView'
import { Topbar, themeToggleLabel } from './Topbar'

const TOC_STORAGE_KEY = 'idocs:toc'

const pad = (n: number) => String(n).padStart(2, '0')

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

/** Reader highlights for the outline's "Your marks", in reading order. */
function marksOf(highlights: Highlight[], sections: StoredPayload['sections']): TocMark[] {
  return [...highlights]
    .sort((a, b) => a.sid - b.sid || (a.bid ?? -1) - (b.bid ?? -1) || a.start - b.start)
    .flatMap((h) => {
      const section = sections[h.sid]
      return section ? [{ id: h.id, sectionId: section.id, text: h.text, ask: h.question !== undefined }] : []
    })
}

const NO_DIAGRAMS: ReadonlySet<ReaderView> = new Set(['diagrams'])

/**
 * The fully-loaded reader UI: Topbar, outline, document, the decision dock
 * slot, the command palette and the annotation popovers/toolbar. Split out
 * from SessionView so it can render inside both ReaderStateProvider and
 * ExportProvider and call useExport() -- useExport() only resolves to a
 * real value for descendants of ExportProvider, not for SessionView itself.
 */
function SessionReady({
  data,
  protectedSession,
}: {
  data: SessionData & { payload: NonNullable<SessionData['payload']> }
  /**
   * Set once the reader has decrypted a protected session's payload for this
   * page view (memory-only, re-locks on navigation/reload). Hides the Archive
   * button entirely -- the envelope is already encrypted, so there is
   * nothing new to save.
   */
  protectedSession?: boolean
}) {
  const { copy, share, downloadMarkdown, print, copyEditPrompt } = useExport()
  const payload = data.payload
  const { theme, toggle: toggleTheme } = useTheme()
  const narrow = useIsNarrow()
  const saveStatus = useSaveStatus()
  const { highlights, dsel, dother } = useReaderState()
  const [view, setView] = useState<ReaderView>('document')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [dockOpen, setDockOpen] = useState(false)
  // The decision the dock should show: focused in the column, current in the sheet.
  const [dockTarget, setDockTarget] = useState<DockTarget | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  // seq restarts the flash when the same section is jumped to twice.
  const [flash, setFlash] = useState<{ id: string; seq: number } | null>(null)
  const [pendingJump, setPendingJump] = useState<string | null>(null)
  const [backTo, setBackTo] = useState<BackTarget | null>(null)
  const [tocCollapsed, setTocCollapsed] = useState(false)
  const [tocDrawerOpen, setTocDrawerOpen] = useState(false)
  // Note/Ask popovers are mutually exclusive -- opening one always closes
  // the other, matching the prototype's single-notePop/single-askPop state.
  const [notePopId, setNotePopId] = useState<string | null>(null)
  const [askPopId, setAskPopId] = useState<string | null>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  // Local, display-only override -- deliberately NOT written back into `data`
  // (or anything the outer SessionView's `data.encrypted` render gate reads).
  // After an encrypt-save, SessionReady keeps rendering the CURRENT decrypted
  // payload already in memory; only the Archive icon reflects the new status.
  // Mutating `data.encrypted` here would make the component fall through to
  // the "Protected session" placeholder on next render, which would
  // incorrectly blank a doc the reader is actively viewing.
  const [savedOverride, setSavedOverride] = useState(false)
  const archived = savedOverride || data.saved

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

  const sections = payload.sections
  const hasDecisions = payload.decisions.length > 0
  const shownSections = useMemo(() => {
    if (view === 'raw') return []
    if (view === 'diagrams') return sections.filter(hasDiagrams)
    return sections
  }, [sections, view])
  const activeId = useActiveSection(shownSections.map((s) => s.id))
  // The outline's warn dot: sections an unanswered decision points to (D7 refs).
  const openSectionIds = useMemo(
    () =>
      new Set(
        payload.decisions.flatMap((d) =>
          isAnswered(d, { dsel, dother }) ? [] : resolveRefs(d, sections).map((ref) => ref.id),
        ),
      ),
    [payload.decisions, sections, dsel, dother],
  )
  const diffNodeStatus = useMemo(() => collectDiffNodeStatus(sections), [sections])
  const disabledViews = useMemo(() => (sections.some(hasDiagrams) ? undefined : NO_DIAGRAMS), [sections])
  const rawMarkdown = useMemo(
    () => (view === 'raw' ? payloadToMarkdown(payload, { url: `${window.location.origin}/s/${data.id}` }) : ''),
    [view, payload, data.id],
  )

  const flashSection = useCallback((id: string, el: HTMLElement) => {
    scrollToElement(el)
    setFlash((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }))
  }, [])

  // A section the current view does not render (Raw, or Diagrams without
  // diagrams in it) is reached by switching back to Document first.
  const jumpTo = useCallback(
    (id: string) => {
      const el = findSection(id)
      if (el) {
        flashSection(id, el)
        return
      }
      setView('document')
      setPendingJump(id)
    },
    [flashSection],
  )

  useEffect(() => {
    if (!pendingJump) return
    setPendingJump(null)
    const el = findSection(pendingJump)
    if (el) flashSection(pendingJump, el)
  }, [pendingJump, flashSection])

  function jumpToMark(mark: TocMark) {
    const el = [...document.querySelectorAll<HTMLElement>('main mark[data-mark-id]')].find(
      (m) => m.dataset.markId === mark.id,
    )
    if (el) scrollToElement(el, 'center')
    else jumpTo(mark.sectionId)
  }

  const showDecision = useCallback((id: string) => setDockTarget((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 })), [])
  // A sheet chip switches the question without taking focus off the chip.
  const selectDecision = useCallback((id: string) => setDockTarget((prev) => ({ id, seq: prev?.seq ?? 0 })), [])

  const goToDecision = useCallback(
    (id: string) => {
      showDecision(id)
      if (narrow) setDockOpen(true)
    },
    [showDecision, narrow],
  )

  // A context chip (D7): the sheet closes so the section shows, and the Back pill returns.
  const jumpToContext = useCallback(
    (sectionId: string, decisionId: string) => {
      setDockOpen(false)
      jumpTo(sectionId)
      setBackTo({ sectionId, decisionId })
    },
    [jumpTo],
  )
  const dismissBack = useCallback(() => setBackTo(null), [])

  // The sheet takes the request number it mounts with as already handled, so under 880
  // the focusing request goes out once the sheet is open.
  function backToDecision(id: string) {
    setBackTo(null)
    if (!narrow) {
      showDecision(id)
      return
    }
    selectDecision(id)
    setDockOpen(true)
    requestAnimationFrame(() => showDecision(id))
  }

  // "Open dock" starts on the next open decision, as B-Mobile's peek bar says.
  const openDockSheet = useCallback(
    (open: boolean) => {
      const first = payload.decisions[0]
      if (open && first) showDecision((nextOpenDecision(payload.decisions, readerStateStore.getState()) ?? first).id)
      setDockOpen(open)
    },
    [payload.decisions, readerStateStore, showDecision],
  )

  // Copies at once and opens the review with the same text, to edit and copy again.
  function copyPrompt() {
    const state = readerStateStore.getState()
    void copy(buildReplyPrompt(payload.decisions, state, payload.meta.title, data.id, flagPromptLines(payload, state)))
    setReviewOpen(true)
  }

  function goToNextDecision() {
    const from = document.activeElement?.closest<HTMLElement>('[data-decision]')?.dataset.decision
    const next = nextOpenDecision(payload.decisions, readerStateStore.getState(), from)
    if (next) goToDecision(next.id)
  }

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

  // Stable identities for the overlay dismiss handlers below.
  const closeSaveModal = useCallback(() => setSaveModalOpen(false), [])
  const closeNotePopover = useCallback(() => setNotePopId(null), [])
  const closeAskPopover = useCallback(() => setAskPopId(null), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), [])
  const closeTocDrawer = useCallback(() => setTocDrawerOpen(false), [])
  const closeReview = useCallback(() => setReviewOpen(false), [])
  const openSaveModal = protectedSession ? undefined : () => setSaveModalOpen(true)
  const openPalette = () => setPaletteOpen(true)
  const openShortcuts = () => setShortcutsOpen(true)

  function jumpAdjacent(direction: 1 | -1) {
    const id = adjacentSectionId(direction)
    if (id) jumpTo(id)
  }

  useShortcuts({
    palette: openPalette,
    nextSection: () => jumpAdjacent(1),
    prevSection: () => jumpAdjacent(-1),
    nextDecision: goToNextDecision,
    copyPrompt: () => {
      if (!document.getElementById('dock')?.contains(document.activeElement)) return false
      copyPrompt()
    },
    help: openShortcuts,
  })

  const documentEntries = useMemo(() => buildDocumentEntries(payload), [payload])
  const paletteEntries: PaletteEntry[] = [
    ...documentEntries,
    { kind: 'action', key: 'a:edit', label: 'Copy edit prompt', run: copyEditPrompt },
    { kind: 'action', key: 'a:markdown', label: 'Download Markdown', run: downloadMarkdown },
    { kind: 'action', key: 'a:pdf', label: 'Download PDF', run: print },
    ...(openSaveModal ? [{ kind: 'action' as const, key: 'a:archive', label: 'Archive', run: openSaveModal }] : []),
    { kind: 'action', key: 'a:share', label: 'Share', run: share },
    { kind: 'action', key: 'a:theme', label: themeToggleLabel(theme), run: toggleTheme },
    { kind: 'action', key: 'a:shortcuts', label: 'Show all shortcuts', run: openShortcuts },
  ]

  function selectEntry(entry: PaletteEntry) {
    if (entry.kind === 'section' || entry.kind === 'block') jumpTo(entry.sectionId)
    else if (entry.kind === 'decision') goToDecision(entry.decisionId)
    else entry.run()
  }

  const counterSection = sections.find((s) => s.id === activeId) ?? sections[0]
  const sectionCounter = counterSection ? `§${pad(counterSection.no)} / ${pad(sections.length)}` : undefined
  const mod = modKeyLabel()

  return (
    <GlossaryProvider payload={payload} onSection={jumpTo} onDecision={goToDecision}>
    <div className="min-h-screen bg-page">
      <Topbar
        sessionId={data.id}
        title={payload.meta.title}
        sectionCounter={sectionCounter}
        view={view}
        onViewChange={setView}
        disabledViews={disabledViews}
        paletteHint={mod === '⌘' ? '⌘K' : `${mod} K`}
        onOpenPalette={openPalette}
        saveStatus={saveStatus}
        archived={archived}
        onOpenOutline={() => setTocDrawerOpen(true)}
        onSave={openSaveModal}
        onEditPrompt={copyEditPrompt}
        onDownload={downloadMarkdown}
        onPrint={print}
        onShare={share}
        showProgress
      />
      <>
        <DiagramViewerProvider>
          <DiffNodeStatusContext value={diffNodeStatus}>
          <div
            // data-reader-grid: the print stylesheet turns this flex row back
            // into one column, since the outline does not print.
            data-reader-grid=""
            className={`flex flex-wrap items-start gap-4 p-4 max-[880px]:px-3 max-[880px]:py-[14px] ${
              // Room for the dock's peek bar (8 + 4 + 10 + 44 + 30 + 1px border, B-Mobile).
              hasDecisions ? 'max-[880px]:pb-[97px]' : ''
            }`}
          >
            <Toc
              sections={sections}
              activeId={activeId}
              marks={marksOf(highlights, sections)}
              openSectionIds={openSectionIds}
              onJump={jumpTo}
              onMarkJump={jumpToMark}
              collapsed={tocCollapsed}
              onToggleCollapsed={toggleTocCollapsed}
              drawerOpen={tocDrawerOpen}
              onCloseDrawer={closeTocDrawer}
            />
            {/* min-w-0: a flex item defaults to min-width:auto, so without this
                the document column cannot shrink below its widest child and one
                wide table or diagram pushes the whole page into a horizontal
                scroll. Wide blocks scroll inside their own box instead. */}
            <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
              <MetaHeader meta={payload.meta} />
              {!hasDecisions && <NoDecisionsNote />}
              {view === 'raw' ? (
                <RawView markdown={rawMarkdown} />
              ) : (
                shownSections.map((s) => (
                  <SectionView
                    key={s.id}
                    section={s}
                    sid={sections.indexOf(s)}
                    onMarkClick={handleMarkClick}
                    flash={flash?.id === s.id ? flash.seq : undefined}
                    only={view === 'diagrams' ? DIAGRAM_BLOCK_TYPES : undefined}
                  />
                ))
              )}
            </main>
            {hasDecisions && (
              <DockSlot
                decisions={payload.decisions}
                open={dockOpen}
                onOpenChange={openDockSheet}
                column={
                  <DecisionDock
                    decisions={payload.decisions}
                    sections={sections}
                    target={dockTarget}
                    onCopyPrompt={copyPrompt}
                    onJumpToContext={jumpToContext}
                  />
                }
                sheet={
                  <DecisionSheet
                    decisions={payload.decisions}
                    sections={sections}
                    target={dockTarget}
                    onSelect={selectDecision}
                    onCopyPrompt={copyPrompt}
                    onJumpToContext={jumpToContext}
                  />
                }
                sheetAction={<ResetAnswers decisions={payload.decisions} variant="sheet" />}
              />
            )}
          </div>
          </DiffNodeStatusContext>
        </DiagramViewerProvider>
      </>
      {backTo && (
        <BackPill
          key={`${backTo.decisionId}:${backTo.sectionId}`}
          target={backTo}
          onDismiss={dismissBack}
          onBack={() => backToDecision(backTo.decisionId)}
        />
      )}
      <SelectionToolbar onRequestNote={openNote} onRequestAsk={openAsk} copyText={copy} />
      {notePopId && <NotePopover id={notePopId} onClose={closeNotePopover} />}
      {askPopId && (
        <AskPopover
          id={askPopId}
          sections={payload.sections}
          sessionId={data.id}
          docTitle={payload.meta.title}
          onClose={closeAskPopover}
          copyText={copy}
        />
      )}
      {paletteOpen && <CommandPalette entries={paletteEntries} onSelect={selectEntry} onClose={closePalette} />}
      {shortcutsOpen && <ShortcutSheet onClose={closeShortcuts} />}
      {reviewOpen && (
        <PromptReviewSheet
          decisions={payload.decisions}
          docTitle={payload.meta.title}
          sessionId={data.id}
          flagLines={(state) => flagPromptLines(payload, state)}
          copyText={copy}
          onClose={closeReview}
          onGoTo={(id) => {
            closeReview()
            goToDecision(id)
          }}
        />
      )}
      {!protectedSession && saveModalOpen && (
        <SaveModal
          sessionId={data.id}
          storedJson={data.raw}
          onClose={closeSaveModal}
          onSaved={(mode) => {
            setSavedOverride(true)
            if (mode === 'encrypt') setEncryptedNow(true)
          }}
          // A save the user cancelled mid-flight can still commit server-side
          // (the PUT cannot be recalled). No toast/modal feedback in that
          // case, but the Archive icon must still reflect server truth.
          onBackgroundSaveSettled={(mode) => {
            setSavedOverride(true)
            if (mode === 'encrypt') setEncryptedNow(true)
          }}
        />
      )}
    </div>
    </GlossaryProvider>
  )
}

function LoadError() {
  return (
    <StatusPage
      line={{ tone: 'failed', text: 'load failed' }}
      title="Something went wrong loading this session."
      help="Your answers saved on this device are safe."
      action={
        <button type="button" onClick={() => window.location.reload()} className={STATUS_ACTION}>
          Retry
        </button>
      }
    />
  )
}

export function SessionView({ id }: { id: string | null }) {
  const { status, data } = useSession(id)
  // Memory-only: never written to sessionStorage/localStorage/IndexedDB.
  // Losing this state (reload, navigating away) re-locks the session, which
  // is the intended behavior for a zero-knowledge protected doc.
  const [decrypted, setDecrypted] = useState<StoredPayload | null>(null)
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null)

  if (status === 'notfound') {
    return (
      <StatusPage
        line={{ tone: 'plain', text: id ? `404 / ${id}` : '404' }}
        title="Session not found or expired."
        help="Check the link, or ask the agent to publish the brief again."
        action={<HomeLink />}
      />
    )
  }

  if (status === 'error') return <LoadError />

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
          <ExportProvider sessionId={data.id} payload={decrypted} encrypted={data.encrypted} expiresAt={data.expiresAt}>
            <ImageKeyContext.Provider value={sessionKey}>
              <SessionReady data={{ ...data, payload: decrypted }} protectedSession />
            </ImageKeyContext.Provider>
          </ExportProvider>
        </ReaderStateProvider>
      )
    }
    if (!data.encParams) {
      return (
        <StatusPage
          line={{ tone: 'locked', text: 'protected' }}
          title="Protected session data is corrupted."
          help="The encrypted copy is missing what it needs to unlock. Ask the agent to publish it again."
        />
      )
    }
    return (
      // B-Overlays:79-89.
      <div className="flex min-h-screen flex-col bg-page text-text">
        <div className="flex h-[45px] shrink-0 items-center gap-2 border-b border-line px-[14px] font-mono text-[13px] leading-[normal]">
          <span aria-hidden="true" className="size-[18px] shrink-0 rounded-ctrl bg-accent" />
          brief<span className="text-faint">/s/{data.id}</span>
        </div>
        <main className="flex grow items-center justify-center p-4">
          <UnlockCard
            ciphertext={data.raw}
            encParams={data.encParams}
            onUnlock={setDecrypted}
            onKey={setSessionKey}
          />
        </main>
      </div>
    )
  }

  if (!data.payload) return <LoadError />

  return (
    <ReaderStateProvider key={data.id} sessionId={data.id}>
      <ExportProvider sessionId={data.id} payload={data.payload} encrypted={data.encrypted} expiresAt={data.expiresAt}>
        <SessionReady data={{ ...data, payload: data.payload }} />
      </ExportProvider>
    </ReaderStateProvider>
  )
}
