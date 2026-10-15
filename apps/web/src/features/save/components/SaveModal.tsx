'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { serializeStoredPayload, type StoredPayload } from '@brief/schema'
import { Dialog, DialogActions, DialogIcon, PRIMARY_BUTTON, SECONDARY_BUTTON, useExport } from '@/features/export'
import { encryptPayload } from '../lib/crypto'
import { ARCHIVE_FAILED, saveSession } from '../lib/api'

const MIN_PASSWORD_LENGTH = 8
// Server's ciphertext char cap (model.ts saveBody / service.ts MAX_CIPHERTEXT_BYTES) --
// the client pre-check must reject before ever running PBKDF2/AES-GCM, not after.
const MAX_CIPHERTEXT_CHARS = 1_950_000

type SaveMode = 'plain' | 'encrypt'

/** The radiogroup's rows, one line of help each (B-Overlays:58-61). */
const MODES: readonly { mode: SaveMode; label: string; help: string }[] = [
  { mode: 'plain', label: 'Archive', help: 'No password.' },
  { mode: 'encrypt', label: 'Archive with password', help: 'Encrypted on this device before upload.' },
]

const TOO_LARGE = 'Document too large to encrypt'
const ARCHIVED = 'Archived. Kept 90 days from last open.'
const NOT_RETRYABLE = new Set([409, 413])

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

/**
 * Projects the base64 ciphertext length AES-256-GCM will produce for a given
 * plaintext, without actually encrypting: base64 inflates bytes by 4/3, and
 * GCM appends a 16-byte authentication tag to the plaintext before that.
 */
function projectedCiphertextChars(plaintextBytes: number): number {
  return Math.ceil((plaintextBytes + 16) / 3) * 4
}

/** "Archive this doc" (B-Overlays:54-71). */
export function SaveModal({
  sessionId,
  payload,
  onClose,
  onSaved,
  onBackgroundSaveSettled,
}: {
  sessionId: string
  payload: StoredPayload
  onClose: () => void
  onSaved: (mode: SaveMode) => void
  /**
   * Fires instead of onSaved when a save the user CANCELLED (Cancel, the
   * close button, or unmount while the PUT was in flight) later resolves OK
   * anyway. The server-side commit cannot be rolled back at that point, so
   * the UI must not lie in either direction: no success toast (the user
   * abandoned the flow), but the caller should still silently reflect server
   * truth (e.g. show the "archived" chip).
   */
  onBackgroundSaveSettled?: (mode: SaveMode) => void
}) {
  const { toast, dismissToast } = useExport()
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([])
  const checkedRadioRef = useRef<HTMLButtonElement | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)
  const [focusPassword, setFocusPassword] = useState(false)
  const cancelledRef = useRef(false)
  const errorToastRef = useRef<number | null>(null)
  const [mode, setMode] = useState<SaveMode>('plain')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const fieldId = useId()

  const dismissErrorToast = useCallback(() => {
    if (errorToastRef.current !== null) dismissToast(errorToastRef.current)
  }, [dismissToast])

  useEffect(() => {
    // Reset on mount: StrictMode's dev-only mount -> cleanup -> remount cycle
    // runs the cleanup below once before the component settles, and a flag
    // that is only ever SET in cleanup would stay true forever after the
    // remount -- silently discarding every save in `next dev`. Any ref flag
    // set by an effect cleanup must be re-initialized in the effect body.
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
      dismissErrorToast()
    }
  }, [dismissErrorToast])

  useEffect(() => {
    if (!focusPassword) return
    setFocusPassword(false)
    passwordRef.current?.focus()
  }, [focusPassword])

  const dismiss = useCallback(() => {
    cancelledRef.current = true
    onClose()
  }, [onClose])

  const passwordTooShort = (submitAttempted || password.length > 0) && password.length < MIN_PASSWORD_LENGTH
  const mismatch = (submitAttempted || confirm.length > 0) && password !== confirm
  const encryptValid = password.length >= MIN_PASSWORD_LENGTH && password === confirm

  function choose(index: number, focus: 'password' | 'radio') {
    const next = MODES[index]!.mode
    if (next !== mode) setSubmitAttempted(false)
    setMode(next)
    if (next === 'encrypt' && focus === 'password') setFocusPassword(true)
    else radioRefs.current[index]?.focus()
  }

  function handleRadioKeyDown(event: React.KeyboardEvent) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const at = MODES.findIndex((m) => m.mode === mode)
    choose((at + step + MODES.length) % MODES.length, 'radio')
  }

  const latestSubmitRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    latestSubmitRef.current = handleSubmit
  })

  function fail(message: string, retryable: boolean) {
    setBusy(false)
    errorToastRef.current = toast({
      kind: 'error',
      message,
      ...(retryable ? { action: { label: 'Retry', run: () => void latestSubmitRef.current() } } : {}),
    })
  }

  /**
   * Shared post-PUT tail for both submit paths. When the user cancelled
   * while the PUT was in flight, the request may already have COMMITTED
   * server-side and cannot be rolled back -- so the UI must not lie in
   * either direction: show no success UI (no toast/onSaved/onClose, the
   * user abandoned the flow), but if the server did accept the save, fire
   * onBackgroundSaveSettled so the caller can silently reflect server truth.
   * A cancelled-then-FAILED PUT fires nothing at all.
   */
  function settleSave(result: Awaited<ReturnType<typeof saveSession>>, saveMode: SaveMode) {
    if (cancelledRef.current) {
      if (result.ok) onBackgroundSaveSettled?.(saveMode)
      return
    }
    if (!result.ok) {
      fail(result.error, !NOT_RETRYABLE.has(result.status))
      return
    }
    setBusy(false)
    toast({ kind: 'archived', message: ARCHIVED })
    onSaved(saveMode)
    onClose()
  }

  async function submitPlain() {
    setBusy(true)
    const result = await saveSession(sessionId, { mode: 'plain' })
    settleSave(result, 'plain')
  }

  async function submitEncrypt() {
    const plaintext = serializeStoredPayload(payload)
    const plaintextBytes = new TextEncoder().encode(plaintext).byteLength
    if (projectedCiphertextChars(plaintextBytes) > MAX_CIPHERTEXT_CHARS) {
      fail(TOO_LARGE, false)
      return
    }

    setBusy(true)
    let encrypted: Awaited<ReturnType<typeof encryptPayload>>
    try {
      encrypted = await encryptPayload(plaintext, password)
    } catch {
      // WebCrypto can throw (unsupported browser/context, key derivation
      // failure) before anything is ever sent -- surface it the same way a
      // failed PUT does instead of leaving the dialog silently stuck busy.
      if (!cancelledRef.current) fail(ARCHIVE_FAILED, true)
      return
    }
    // Cancelled while PBKDF2 was still running: nothing has been sent yet,
    // so the whole operation can be abandoned with no server side effect.
    if (cancelledRef.current) return
    const result = await saveSession(sessionId, {
      mode: 'encrypt',
      ciphertext: encrypted.ciphertext,
      encParams: encrypted.encParams,
    })
    settleSave(result, 'encrypt')
  }

  // B-Overlays:65-69 draws the mismatch with Archive still lit: the button
  // stays enabled and a submit with invalid fields points at the first one.
  async function handleSubmit() {
    if (busy) return
    if (mode === 'encrypt' && !encryptValid) {
      setSubmitAttempted(true)
      const firstInvalid = password.length < MIN_PASSWORD_LENGTH ? passwordRef : confirmRef
      firstInvalid.current?.focus()
      return
    }
    dismissErrorToast()
    if (mode === 'plain') await submitPlain()
    else await submitEncrypt()
  }

  return (
    <Dialog
      title="Archive this doc"
      icon={
        <DialogIcon>
          <rect x="3" y="4" width="18" height="5" rx="1" />
          <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" />
        </DialogIcon>
      }
      busy={busy}
      initialFocusRef={checkedRadioRef}
      onClose={dismiss}
    >
      <div className="flex flex-col gap-[10px] px-[18px] pb-4 pt-[14px]">
        <p className="m-0 text-[13px] leading-5 text-sub">Archiving keeps this doc for 90 days from last open.</p>
        <div role="radiogroup" aria-label="Archive mode" onKeyDown={handleRadioKeyDown} className="flex flex-col gap-[6px]">
          {MODES.map((m, i) => {
            const on = m.mode === mode
            return (
              <button
                key={m.mode}
                ref={(el) => {
                  radioRefs.current[i] = el
                  if (on) checkedRadioRef.current = el
                }}
                type="button"
                role="radio"
                aria-checked={on}
                aria-labelledby={`${fieldId}-${m.mode}`}
                aria-describedby={`${fieldId}-${m.mode}-help`}
                tabIndex={on ? 0 : -1}
                onClick={() => choose(i, 'password')}
                className={`flex min-h-11 cursor-pointer items-center gap-[10px] rounded-ctrl border px-3 py-[6px] text-left text-text transition-[background-color,border-color,transform] duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none ${
                  on ? 'border-accent-line bg-accent-soft' : 'border-line2 bg-card'
                } ${FOCUS_RING}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-[14px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${on ? 'border-accent-line' : 'border-faint'}`}
                >
                  <span className={`size-[6px] rounded-full ${on ? 'bg-accent-line' : 'bg-transparent'}`} />
                </span>
                <span className="flex flex-col">
                  <span id={`${fieldId}-${m.mode}`} className="text-[13px] font-semibold">
                    {m.label}
                  </span>
                  <span id={`${fieldId}-${m.mode}-help`} className="text-[12px] text-faint">
                    {m.help}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {mode === 'encrypt' && (
          <div className="flex flex-col gap-2">
            <PasswordField
              id={`${fieldId}-pw`}
              label="Password"
              value={password}
              onChange={setPassword}
              error={passwordTooShort ? 'Must be at least 8 characters' : null}
              inputRef={passwordRef}
            />
            <PasswordField
              id={`${fieldId}-pw2`}
              label="Confirm password"
              value={confirm}
              onChange={setConfirm}
              error={mismatch ? 'Passwords do not match' : null}
              inputRef={confirmRef}
            />
            <aside className="rounded-ctrl border border-l-[3px] border-warn-line border-l-warn bg-[var(--c-warn-callout)] px-[10px] py-2 text-[12px] leading-[18px] text-text">
              The password never leaves this device. If you lose it, the content cannot be recovered.
            </aside>
          </div>
        )}

        <DialogActions className="pt-1">
          <button type="button" onClick={dismiss} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={busy} className={`${PRIMARY_BUTTON} px-4`}>
            {busy && mode === 'encrypt' ? 'Encrypting…' : 'Archive'}
          </button>
        </DialogActions>
      </div>
    </Dialog>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  inputRef,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error: string | null
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] text-sub">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`min-h-[38px] rounded-ctrl border bg-page px-[10px] text-[16px] text-text ${error ? 'border-bad' : 'border-line2'} ${FOCUS_RING}`}
      />
      {error && (
        <span id={`${id}-error`} className="text-[12px] text-bad">
          {error}
        </span>
      )}
    </div>
  )
}
