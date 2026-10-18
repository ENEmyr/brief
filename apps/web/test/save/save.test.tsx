import { StrictMode, useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { parseStoredPayload, type Payload } from '@brief/schema'
import { saveSession } from '@/features/save/lib/api'
import { decryptPayload } from '@/features/save/lib/crypto'
import { SaveModal } from '@/features/save/components/SaveModal'
import { ExportProvider } from '@/features/export'
import { ReaderStateProvider } from '@/features/reader-state'

const API_URL = 'http://localhost:8787'

function stubFetch(response: { status: number; body?: unknown } | Error) {
  const fn =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(new Response(JSON.stringify(response.body ?? {}), { status: response.status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('saveSession (api.ts)', () => {
  it('PUTs to /api/session/:id/save with the given body and resolves ok on 200', async () => {
    const fetchMock = stubFetch({ status: 200, body: { saved: true, encrypted: false, expiresAt: 123 } })

    const result = await saveSession('sess1', { mode: 'plain' })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/session/sess1/save`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ mode: 'plain' }),
      }),
    )
  })

  it('sends encrypt-mode body with ciphertext and encParams', async () => {
    const fetchMock = stubFetch({ status: 200, body: { saved: true, encrypted: true, expiresAt: 123 } })
    const body = {
      mode: 'encrypt' as const,
      ciphertext: 'abc123',
      encParams: { salt: 's', iv: 'i', iterations: 600_000 },
    }

    const result = await saveSession('sess1', body)

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/session/sess1/save`, expect.objectContaining({
      body: JSON.stringify(body),
    }))
  })

  it('maps 409 to "Already protected"', async () => {
    stubFetch({ status: 409 })
    const result = await saveSession('sess1', { mode: 'plain' })
    expect(result).toEqual({ ok: false, error: 'Already protected', status: 409 })
  })

  it('maps 413 to "Document too large to encrypt"', async () => {
    stubFetch({ status: 413 })
    const result = await saveSession('sess1', { mode: 'plain' })
    expect(result).toEqual({ ok: false, error: 'Document too large to encrypt', status: 413 })
  })

  it('maps 429 to "Too many attempts - try again in a minute"', async () => {
    stubFetch({ status: 429 })
    const result = await saveSession('sess1', { mode: 'plain' })
    expect(result).toEqual({ ok: false, error: 'Too many attempts - try again in a minute', status: 429 })
  })

  it('maps other error statuses to the generic archive failure', async () => {
    stubFetch({ status: 500 })
    const result = await saveSession('sess1', { mode: 'plain' })
    expect(result).toEqual({ ok: false, error: 'Could not archive. Nothing was changed.', status: 500 })
  })

  it('maps a network failure to the generic archive failure', async () => {
    stubFetch(new Error('network down'))
    const result = await saveSession('sess1', { mode: 'plain' })
    expect(result).toEqual({ ok: false, error: 'Could not archive. Nothing was changed.', status: 0 })
  })
})

const payload: Payload = {
  meta: { title: 'Rate Limiter', version: '1.2.0' },
  sections: [{ id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello' }] }],
  decisions: [],
}

function renderModal(onSaved = vi.fn(), onClose = vi.fn(), onBackgroundSaveSettled = vi.fn()) {
  render(
    <ReaderStateProvider sessionId="sess1">
      <ExportProvider sessionId="sess1" payload={payload}>
        <SaveModal
          sessionId="sess1"
          storedJson={JSON.stringify(payload)}
          onClose={onClose}
          onSaved={onSaved}
          onBackgroundSaveSettled={onBackgroundSaveSettled}
        />
      </ExportProvider>
    </ReaderStateProvider>,
  )
  return { onSaved, onClose, onBackgroundSaveSettled }
}

/**
 * Stubs fetch so ReaderStateProvider's mount-time KV-sync GET resolves
 * immediately, while the save PUT stays pending under manual control --
 * needed by the cancel-during-in-flight tests, which must cancel AFTER the
 * PUT has fired but BEFORE it settles.
 */
function stubFetchWithPendingPut() {
  let resolvePut: (value: Response) => void = () => {}
  const putPromise = new Promise<Response>((resolve) => {
    resolvePut = resolve
  })
  const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return putPromise
    return Promise.resolve(new Response(JSON.stringify({ state: null }), { status: 200 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  const putFired = () => fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
  return { fetchMock, resolvePut: (r: Response) => resolvePut(r), putFired }
}

describe('SaveModal', () => {
  it('renders the dialog with plain mode selected by default', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Archive this doc' })).toBeInTheDocument()
    expect(screen.getByText(/Archiving keeps this doc for 90 days/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeEnabled()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('saves plain mode: calls saveSession with mode plain, toasts, and closes', async () => {
    stubFetch({ status: 200, body: { saved: true, encrypted: false, expiresAt: 1 } })
    const { onSaved, onClose } = renderModal()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Archive' })))

    expect(onSaved).toHaveBeenCalledWith('plain')
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Archived. Kept 90 days from last open.'))
  })

  // B-Overlays:65-69 draws the mismatch with Archive still lit.
  it('selecting "Archive with password" reveals the password fields; Archive with them empty saves nothing and points at Password', () => {
    const fetchMock = stubFetch({ status: 200, body: { state: null } })
    renderModal()
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))

    expect(screen.getByRole('radio', { name: 'Archive with password' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Archive' })).toHaveAttribute('aria-checked', 'false')
    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toHaveFocus()
    expect(screen.getByText(/never leaves this device/)).toBeInTheDocument()
    expect(passwordInput).not.toHaveAttribute('aria-invalid')

    screen.getByRole('radio', { name: 'Archive with password' }).focus()
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    expect(passwordInput).toHaveFocus()
    expect(passwordInput).toHaveAccessibleDescription('Must be at least 8 characters')
    expect(screen.getByLabelText('Confirm password')).not.toHaveAttribute('aria-invalid')
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'PUT')).toBe(true)
  })

  it('shows an inline hint for a too-short password', () => {
    renderModal()
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Must be at least 8 characters')
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows an inline mismatch error when confirm does not match password', () => {
    renderModal()
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password124' } })

    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords do not match')
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid')

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(screen.getByLabelText('Confirm password')).toHaveFocus()
  })

  it('switching mode clears the field errors a submit raised', () => {
    stubFetch({ status: 200, body: { state: null } })
    renderModal()
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')

    fireEvent.click(screen.getByRole('radio', { name: 'Archive' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))

    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid')
  })

  it('shows no field error once password and confirm match and meet the minimum length', () => {
    renderModal()
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })

    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByLabelText('Confirm password')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('button', { name: 'Archive' })).toBeEnabled()
  })

  it('encrypt path: calls encryptPayload then saveSession with mode encrypt + encParams, toasts, and closes', async () => {
    stubFetch({ status: 200, body: { saved: true, encrypted: true, expiresAt: 1 } })
    const { onSaved, onClose } = renderModal()
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })

    // Real PBKDF2 (600k iterations) runs here, so the submit handler's promise
    // outlives the click event itself -- wait for the outcome instead of
    // asserting immediately after act(), same as the busy-state test below.
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('encrypt'))
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Archived. Kept 90 days from last open.'))
  })

  it('shows "Encrypting…" and disables submit while PBKDF2/save is in flight', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
      ),
    )
    renderModal()
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Encrypting…' })).toBeDisabled())

    // Must wait for the whole chain to settle before the test ends -- an
    // unawaited resolve here lets setBusy/toast/onSaved/onClose fire AFTER
    // RTL's automatic per-test unmount and jsdom teardown, throwing
    // "window is not defined" as an unhandled rejection that only surfaced
    // in CI's stricter timing (not reproduced by a handful of local runs).
    resolveFetch(new Response(JSON.stringify({ saved: true, encrypted: true, expiresAt: 1 }), { status: 200 }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Archived. Kept 90 days from last open.'))
  })

  it('reports a 409 in an error toast without Retry and keeps the dialog open', async () => {
    stubFetch({ status: 409 })
    const { onClose } = renderModal()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Archive' })))

    expect(screen.getByRole('alert')).toHaveTextContent('Already protected')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Archive this doc' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('reports a 413 in an error toast without Retry and keeps the dialog open', async () => {
    stubFetch({ status: 413 })
    const { onClose } = renderModal()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Archive' })))

    expect(screen.getByRole('alert')).toHaveTextContent('Document too large to encrypt')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a failed save shows the error toast with Retry, which saves what the dialog holds by then', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve(new Response(JSON.stringify({ state: null }), { status: init?.method === 'PUT' ? 500 : 200 })),
      )
    vi.stubGlobal('fetch', fetchMock)
    const { onSaved, onClose } = renderModal()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Archive' })))

    expect(screen.getByRole('alert')).toHaveTextContent('Could not archive. Nothing was changed.')
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ saved: true, encrypted: true, expiresAt: 1 }), { status: 200 })),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('encrypt'))
    const retried = fetchMock.mock.calls.at(-1)![1] as RequestInit
    expect(JSON.parse(retried.body as string)).toMatchObject({ mode: 'encrypt' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Archived. Kept 90 days from last open.')
  })

  it('the error toast stays past 1.6s and leaves when the dialog closes, so Retry cannot outlive it', async () => {
    stubFetch({ status: 500 })
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <ReaderStateProvider sessionId="sess1">
          <ExportProvider sessionId="sess1" payload={payload}>
            {open && <SaveModal sessionId="sess1" storedJson={JSON.stringify(payload)} onClose={() => setOpen(false)} onSaved={vi.fn()} />}
          </ExportProvider>
        </ReaderStateProvider>
      )
    }
    render(<Harness />)

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Archive' })))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1700))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not archive. Nothing was changed.')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('pre-checks projected ciphertext size and skips crypto entirely when too large', async () => {
    // ReaderStateProvider fires its own KV-sync GET on mount, independent of Archive --
    // stub it to succeed so the only thing left to assert is that Archive never PUTs.
    const fetchMock = stubFetch({ status: 200, body: { state: null } })
    const hugePayload: Payload = {
      ...payload,
      sections: [
        {
          id: 's1',
          no: 1,
          title: 'Intro',
          // ~2M chars of plaintext comfortably exceeds the 1,950,000-char projected
          // base64 ciphertext cap even before the +16 GCM tag / *4/3 inflation.
          blocks: [{ type: 'p', text: 'a'.repeat(2_000_000) }],
        },
      ],
    }
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(
      <ReaderStateProvider sessionId="sess1">
        <ExportProvider sessionId="sess1" payload={hugePayload}>
          <SaveModal sessionId="sess1" storedJson={JSON.stringify(hugePayload)} onClose={onClose} onSaved={onSaved} />
        </ExportProvider>
      </ReaderStateProvider>,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Document too large to encrypt')
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'PUT')).toBe(true)
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes via the close button, Escape, and backdrop click', () => {
    const { onClose } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('Cancel closes the modal without saving', () => {
    // ReaderStateProvider fires its own KV-sync GET on mount, independent of
    // Archive -- assert no PUT (the save call) fires, not "no fetch at all".
    const fetchMock = stubFetch({ status: 200, body: { state: null } })
    const { onClose } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'PUT')).toBe(true)
  })
})

describe('SaveModal cancel during an in-flight save', () => {
  it('cancel during a pending encrypt PUT: no toast/onSaved, onBackgroundSaveSettled("encrypt") when it later resolves ok', async () => {
    const { resolvePut, putFired } = stubFetchWithPendingPut()
    const { onSaved, onClose, onBackgroundSaveSettled } = renderModal()
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    // Wait for the real PBKDF2 to finish and the PUT to actually be in flight.
    await waitFor(() => expect(putFired()).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    resolvePut(new Response(JSON.stringify({ saved: true, encrypted: true, expiresAt: 1 }), { status: 200 }))

    // The server DID commit, so the settled callback must fire so the UI can
    // reflect server truth -- but no success UI (toast/onSaved) may appear.
    await waitFor(() => expect(onBackgroundSaveSettled).toHaveBeenCalledWith('encrypt'))
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cancel during a pending plain PUT: no toast/onSaved, onBackgroundSaveSettled("plain") when it later resolves ok', async () => {
    const { resolvePut, putFired } = stubFetchWithPendingPut()
    const { onSaved, onClose, onBackgroundSaveSettled } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(putFired()).toBe(true))

    // While busy Escape and the scrim do not close (interactions.md).
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    resolvePut(new Response(JSON.stringify({ saved: true, encrypted: false, expiresAt: 1 }), { status: 200 }))

    await waitFor(() => expect(onBackgroundSaveSettled).toHaveBeenCalledWith('plain'))
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a PUT that fails after cancel fires nothing: no settled callback, no error UI, no toast', async () => {
    const { resolvePut, putFired } = stubFetchWithPendingPut()
    const { onSaved, onClose, onBackgroundSaveSettled } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(putFired()).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolvePut(new Response('{}', { status: 500 }))
    })

    expect(onBackgroundSaveSettled).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('saves normally under React StrictMode (cancel flag must reset on remount)', async () => {
    // StrictMode's dev-only mount -> cleanup -> remount cycle runs the unmount
    // cleanup (which sets cancelledRef true) once before the component settles.
    // Without resetting the flag in the effect BODY, every save in `next dev`
    // (App Router defaults StrictMode on) is silently discarded as cancelled.
    stubFetch({ status: 200, body: { saved: true, encrypted: false, expiresAt: 1 } })
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(
      <StrictMode>
        <ReaderStateProvider sessionId="sess1">
          <ExportProvider sessionId="sess1" payload={payload}>
            <SaveModal sessionId="sess1" storedJson={JSON.stringify(payload)} onClose={onClose} onSaved={onSaved} />
          </ExportProvider>
        </ReaderStateProvider>
      </StrictMode>,
    )

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Archive' })))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('plain'))
    expect(onClose).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Archived')
  })
})

describe('SaveModal archive with a password', () => {
  it('encrypts the stored JSON byte for byte, fields this reader does not know included', async () => {
    const stored = JSON.stringify({
      meta: { title: 'Rollout', futureMeta: 1 },
      sections: [{ id: 's1', no: 1, title: 'Intro', futureSection: true, blocks: [{ type: 'p', text: 'Hello', futureField: 'newer agent' }] }],
      decisions: [],
    })
    const storedPayload = parseStoredPayload(JSON.parse(stored))
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ saved: true, encrypted: true, expiresAt: 1, state: null }), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn()
    render(
      <ReaderStateProvider sessionId="sess1">
        <ExportProvider sessionId="sess1" payload={storedPayload}>
          <SaveModal sessionId="sess1" storedJson={stored} onClose={vi.fn()} onSaved={onSaved} />
        </ExportProvider>
      </ReaderStateProvider>,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('encrypt'))
    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
    const body = JSON.parse((putCall![1] as RequestInit).body as string) as { ciphertext: string; encParams: { salt: string; iv: string; iterations: number } }
    expect(await decryptPayload(body.ciphertext, 'password123', body.encParams)).toBe(stored)
  }, 30_000)
})
