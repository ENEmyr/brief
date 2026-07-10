// Re-exported from shared/clipboard.ts (single source, same "small helper
// multiple features need" precedent as annotations/lib/clipboard.ts's
// defaultCopyText re-export). ExportProvider is the only caller that owns
// the *side effects* of a copy attempt (toast on success, CopyFallbackModal
// on failure) -- this module stays a pure pass-through of the copy chain.
export { copyText } from '@/shared/clipboard'
