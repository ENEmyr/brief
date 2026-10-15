'use client'
import { useId, useRef, useState, type FormEvent } from 'react'
import { parseStoredPayload, type EncParams, type StoredPayload } from '@brief/schema'
import { decryptPayload, decryptPayloadWithKey, deriveSessionKey } from '../lib/crypto'

/**
 * Protected-session password unlock card (ADR-0001, decision log 131), drawn
 * as B-Overlays' Unlock page (lines 82-87): a page, not a dialog. SessionView
 * owns the page around it.
 *
 * Security posture: the password and the decrypted payload live in this
 * component's React state only (never persisted to storage), and a wrong
 * password vs. corrupt/tampered ciphertext are deliberately indistinguishable
 * in the UI -- `decryptPayload` throwing (GCM auth failure) and a successful
 * decrypt that then fails `JSON.parse` or `parseStoredPayload` both surface the
 * exact same copy, so a wrong-password guess can't be told apart from
 * corrupted data by an attacker probing the UI.
 */
export function UnlockCard({
  ciphertext,
  encParams,
  onUnlock,
  onKey,
}: {
  ciphertext: string
  encParams: EncParams
  onUnlock: (payload: StoredPayload) => void
  /** Receives the key that decrypts the session's encrypted images, before onUnlock. */
  onKey?: (key: CryptoKey) => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldId = useId()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || password.length === 0) return
    setBusy(true)
    setError(null)
    try {
      // One key derivation either way: 600k PBKDF2 rounds are the slow part of unlock.
      const key = onKey === undefined ? null : await deriveSessionKey(password, encParams)
      const plaintext =
        key === null
          ? await decryptPayload(ciphertext, password, encParams)
          : await decryptPayloadWithKey(ciphertext, key, encParams)
      const payload = parseStoredPayload(JSON.parse(plaintext))
      // The caller (SessionView) swaps to the ready view with the decrypted
      // payload once onUnlock fires, normally unmounting this component --
      // busy still resets here regardless, matching SaveModal's settleSave
      // convention of always clearing busy before the success tail runs.
      setBusy(false)
      if (key !== null) onKey?.(key)
      onUnlock(payload)
    } catch {
      // Same copy for a WebCrypto auth failure (wrong password), a JSON.parse
      // failure (corrupt ciphertext), and a schema-validation failure
      // (corrupt but well-formed JSON) -- never reveal which one occurred.
      setPassword('')
      setError('Wrong password or corrupted data.')
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-[406px] max-w-full flex-col gap-3 rounded-overlay border border-line bg-card p-[22px] leading-[normal] text-text"
    >
      <div className="flex items-center gap-[10px]">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-ctrl bg-chip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent-line">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
        <h1 className="m-0 text-[16px] font-semibold">Protected session</h1>
      </div>
      <p className="m-0 text-[13px] leading-5 text-sub">
        This doc is end-to-end encrypted. Enter the password to unlock it on this device.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor={fieldId} className="text-[12px] text-sub">
          Password
        </label>
        <input
          ref={inputRef}
          id={fieldId}
          type="password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={`min-h-[42px] rounded-ctrl border bg-page px-[10px] text-[16px] text-text disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line ${
            error ? 'border-bad' : 'border-line2'
          }`}
        />
        {error && (
          <span id={`${fieldId}-error`} role="alert" className="text-[12px] text-bad">
            {error}
          </span>
        )}
      </div>
      <button
        type="submit"
        // B-Overlays:86 draws the error state, field cleared, with Unlock still lit; an empty submit is a no-op.
        disabled={busy}
        className="min-h-11 cursor-pointer rounded-ctrl border-0 bg-accent px-4 text-[14px] font-semibold text-on-accent transition-transform duration-[var(--dur-fast)] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
      >
        {busy ? 'Decrypting…' : 'Unlock'}
      </button>
    </form>
  )
}
