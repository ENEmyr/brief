'use client'
import { useRef, useState } from 'react'
import type { Payload } from '@brief/schema'
import { useDialogFocus, useExport } from '@/features/export'
import { encryptPayload } from '../lib/crypto'
import { saveSession } from '../lib/api'

const MIN_PASSWORD_LENGTH = 8
// Server's ciphertext char cap (model.ts saveBody / service.ts MAX_CIPHERTEXT_BYTES) --
// the client pre-check must reject before ever running PBKDF2/AES-GCM, not after.
const MAX_CIPHERTEXT_CHARS = 1_950_000

type SaveMode = 'plain' | 'encrypt'

/**
 * Projects the base64 ciphertext length AES-256-GCM will produce for a given
 * plaintext, without actually encrypting: base64 inflates bytes by 4/3, and
 * GCM appends a 16-byte authentication tag to the plaintext before that.
 */
function projectedCiphertextChars(plaintextBytes: number): number {
  return Math.ceil((plaintextBytes + 16) / 3) * 4
}

/**
 * Save dialog (design language follows ShareModal chrome -- prototype has no
 * direct save-modal reference). Two save modes: plain (mode: 'plain') or
 * end-to-end encrypted (mode: 'encrypt', password never leaves this device).
 * Joins the shared dialog stack via useDialogFocus (bug-214) so Escape only
 * closes this dialog when it is topmost.
 */
export function SaveModal({
  sessionId,
  payload,
  onClose,
  onSaved,
}: {
  sessionId: string
  payload: Payload
  onClose: () => void
  onSaved: (mode: SaveMode) => void
}) {
  const { toast } = useExport()
  const panelRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<SaveMode>('plain')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useDialogFocus(panelRef, onClose)

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH
  const mismatch = confirm.length > 0 && password !== confirm
  const encryptValid = password.length >= MIN_PASSWORD_LENGTH && password === confirm
  const canSubmit = !busy && (mode === 'plain' || encryptValid)

  async function submitPlain() {
    setBusy(true)
    const result = await saveSession(sessionId, { mode: 'plain' })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast('Saved')
    onSaved('plain')
    onClose()
  }

  async function submitEncrypt() {
    const plaintext = JSON.stringify(payload)
    const plaintextBytes = new TextEncoder().encode(plaintext).byteLength
    if (projectedCiphertextChars(plaintextBytes) > MAX_CIPHERTEXT_CHARS) {
      setError('Document too large to encrypt')
      return
    }

    setBusy(true)
    const { ciphertext, encParams } = await encryptPayload(plaintext, password)
    const result = await saveSession(sessionId, { mode: 'encrypt', ciphertext, encParams })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast('Saved with password')
    onSaved('encrypt')
    onClose()
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    if (mode === 'plain') await submitPlain()
    else await submitEncrypt()
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex justify-center bg-black/50 px-5"
      style={{ paddingTop: '14vh' }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Save this doc"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="h-fit w-[min(92vw,440px)] rounded-[14px] border border-line bg-card p-5 shadow-[var(--shadow-card)]"
        style={{ animation: 'dc-pop .18s ease' }}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[15px] font-bold">⛉ Save this doc</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="max-[879px]:min-h-11 max-[879px]:min-w-11 cursor-pointer rounded-md border-0 bg-transparent text-base text-sub"
          >
            ✕
          </button>
        </div>
        <p className="mb-3.5 text-[13px] text-sub">Saving keeps this doc for 90 days from last open.</p>

        <div className="mb-3 flex flex-col gap-2" role="group" aria-label="Save mode">
          <button
            type="button"
            aria-pressed={mode === 'plain'}
            // Distinguishes this option row's accessible name from the footer's
            // "Save" submit button (both show the literal word "Save" per the
            // design copy) -- same one-attribute-addition posture as
            // PromptReview's aria-label fix, harmless for and arguably helpful
            // to real screen-reader users.
            aria-label="Save without a password"
            onClick={() => setMode('plain')}
            className={`max-[879px]:min-h-11 w-full rounded-[9px] border px-3 py-[9px] text-left text-[13.5px] transition-colors ${
              mode === 'plain' ? 'border-mauve bg-mauvesoft text-text' : 'border-line bg-card text-sub'
            }`}
          >
            <span aria-hidden="true" className="font-semibold">
              Save
            </span>
          </button>
          <button
            type="button"
            aria-pressed={mode === 'encrypt'}
            onClick={() => setMode('encrypt')}
            className={`max-[879px]:min-h-11 w-full rounded-[9px] border px-3 py-[9px] text-left text-[13.5px] transition-colors ${
              mode === 'encrypt' ? 'border-mauve bg-mauvesoft text-text' : 'border-line bg-card text-sub'
            }`}
          >
            <span className="font-semibold">Save with password</span>
          </button>
        </div>

        {mode === 'encrypt' && (
          <div className="mb-3 flex flex-col gap-2.5">
            <div>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-label="Password"
                placeholder="Password"
                className="w-full rounded-[9px] border border-line bg-elev px-3 py-[9px] text-[13px] text-text"
              />
              {passwordTooShort && <p className="mt-1 text-[12px] text-red">Must be at least 8 characters</p>}
            </div>
            <div>
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                aria-label="Confirm password"
                placeholder="Confirm password"
                className="w-full rounded-[9px] border border-line bg-elev px-3 py-[9px] text-[13px] text-text"
              />
              {mismatch && <p className="mt-1 text-[12px] text-red">Passwords do not match</p>}
            </div>
            <aside className="rounded-lg border-l-[3px] border-peach bg-[var(--callout-warn-bg)] px-[15px] py-[11px] text-[12.5px] leading-[1.6] text-text">
              The password never leaves this device. If you lose it, the content cannot be recovered.
            </aside>
          </div>
        )}

        {error && (
          <p role="alert" className="mb-3 text-[12.5px] text-red">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="max-[879px]:min-h-11 flex-1 cursor-pointer rounded-[9px] border-0 bg-mauve px-4 py-[9px] text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && mode === 'encrypt' ? 'Encrypting…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="max-[879px]:min-h-11 cursor-pointer rounded-[9px] border border-line bg-card px-4 py-[9px] text-[13px] font-semibold text-sub"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
