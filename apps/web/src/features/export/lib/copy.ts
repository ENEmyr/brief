// Re-exported from shared/clipboard.ts (single source, same "small helper
// multiple features need" precedent as annotations/lib/clipboard.ts's
// defaultCopyText re-export). ExportProvider is the only caller that owns
// the *side effects* of a copy attempt (toast on success, CopyFallbackModal
// on failure) -- this module stays a pure pass-through of the copy chain.
// execCommandCopy is the synchronous-only step, used by CopyFallbackModal's
// "Try copy again" per the prototype (Reader.dc.html line 335).
export { copyText, execCommandCopy } from '@/shared/clipboard'
