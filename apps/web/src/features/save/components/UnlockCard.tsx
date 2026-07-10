'use client'
import { useRef, useState, type FormEvent } from 'react'
import { payloadSchema, type EncParams, type Payload } from '@brief/schema'
import { decryptPayload } from '../lib/crypto'

/**
 * Protected-session password unlock form (ADR-0001, decision log 131). Meant
 * to be rendered inside the standard page chrome (SessionView wraps it in
 * the same Topbar+centered-card `StatusCard` used for the other status
 * states), so this component only owns the title/copy/form -- not the page
 * shell.
 *
 * Security posture: the password and the decrypted payload live in this
 * component's React state only (never persisted to storage), and a wrong
 * password vs. corrupt/tampered ciphertext are deliberately indistinguishable
 * in the UI -- `decryptPayload` throwing (GCM auth failure) and a successful
 * decrypt that then fails `JSON.parse` or `payloadSchema` both surface the
 * exact same copy, so a wrong-password guess can't be told apart from
 * corrupted data by an attacker probing the UI.
 */
export function UnlockCard({
  ciphertext,
  encParams,
  onUnlock,
}: {
  ciphertext: string
  encParams: EncParams
  onUnlock: (payload: Payload) => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || password.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const plaintext = await decryptPayload(ciphertext, password, encParams)
      const parsed = payloadSchema.safeParse(JSON.parse(plaintext))
      if (!parsed.success) throw new Error('Decrypted payload failed schema validation.')
      // The caller (SessionView) swaps to the ready view with the decrypted
      // payload once onUnlock fires, normally unmounting this component --
      // busy still resets here regardless, matching SaveModal's settleSave
      // convention of always clearing busy before the success tail runs.
      setBusy(false)
      onUnlock(parsed.data)
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
    <>
      <h1 className="mb-2 text-[15px] font-bold text-text">Protected session</h1>
      <p className="mb-4 text-[13px] leading-[1.6] text-sub">
        This doc is end-to-end encrypted. Enter the password to unlock it on this device.
      </p>
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-xs flex-col gap-3 text-left">
        <input
          ref={inputRef}
          type="password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          aria-label="Password"
          placeholder="Password"
          className="w-full rounded-[9px] border border-line bg-elev px-3 py-[9px] text-[13px] text-text disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="min-h-11 cursor-pointer rounded-[9px] border-0 bg-mauve px-4 py-[9px] text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Decrypting…' : 'Unlock'}
        </button>
        <p aria-live="polite" className="min-h-[1em] text-[12.5px] text-red">
          {error}
        </p>
      </form>
    </>
  )
}
