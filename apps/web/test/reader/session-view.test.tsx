import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import SessionPage from '@/app/s/page'
import { encryptPayload } from '@/features/save/lib/crypto'

const validPayload = {
  meta: {
    title: 'Test Doc',
    author: 'Ada',
    date: '2026-07-10',
    version: '1.0',
    repo: 'https://github.com/example/repo',
    readTime: '5 min',
  },
  sections: [{ id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello world' }] }],
  decisions: [],
}

const validEnvelope = {
  id: 'abc12345678901',
  title: 'Test Doc',
  saved: false,
  encrypted: false,
  encParams: null,
  payload: JSON.stringify(validPayload),
  createdAt: 1,
  lastOpenedAt: 1,
  expiresAt: 2,
}

afterEach(() => vi.unstubAllGlobals())

describe('SessionPage / SessionView', () => {
  it('renders skeleton first, then title, section heading and paragraph after resolve', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(validEnvelope))))

    render(<SessionPage />)

    expect(screen.queryByText('Test Doc')).not.toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Test Doc')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: /Intro/ })).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('shows not-found message on 404', async () => {
    window.history.replaceState(null, '', '/s/missing12345678/')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"x"}', { status: 404 })),
    )

    render(<SessionPage />)

    await waitFor(() =>
      expect(screen.getByText(/Session not found or expired/i)).toBeInTheDocument(),
    )
  })

  it('renders the Decisions section and its TOC entry when the payload has decisions', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const withDecisions = {
      ...validPayload,
      decisions: [
        {
          id: 'd1',
          q: 'Which cache?',
          multi: false,
          opts: [{ id: 'kv', label: 'KV' }, { id: 'none', label: 'None' }],
        },
      ],
    }
    const envelope = { ...validEnvelope, payload: JSON.stringify(withDecisions) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope))))

    render(<SessionPage />)

    await waitFor(() => expect(screen.getByText('Test Doc')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: '02 Decisions' })).toBeInTheDocument()
    const el = document.getElementById('decide')
    expect(el).not.toBeNull()
    expect(el).toHaveAttribute('data-section', 'decide')
    // TOC gets an appended "Decisions" entry pointing at the same section.
    expect(screen.getAllByText('Decisions').length).toBeGreaterThan(1)
  })

  it('shows the UnlockCard password form for encrypted sessions (no stub text)', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const encEnvelope = {
      ...validEnvelope,
      encrypted: true,
      payload: 'ciphertext',
      encParams: { salt: 'a', iv: 'b', iterations: 600_000 },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(encEnvelope))))

    render(<SessionPage />)

    await waitFor(() => expect(screen.getByText('Protected session')).toBeInTheDocument())
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument()
    expect(screen.queryByText(/arrives in a later release/i)).not.toBeInTheDocument()
  })

  it('unlocking a protected session (real WebCrypto round trip) renders the ready view with the decrypted payload, no Save button, and a "protected" chip', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const { ciphertext, encParams } = await encryptPayload(JSON.stringify(validPayload), 'correct-horse')
    const encEnvelope = {
      ...validEnvelope,
      encrypted: true,
      saved: true,
      payload: ciphertext,
      encParams,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(encEnvelope))))

    render(<SessionPage />)
    await waitFor(() => expect(screen.getByText('Protected session')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => expect(screen.getByText('Test Doc')).toBeInTheDocument())
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.getByText('protected')).toBeInTheDocument()
  })

  it('wrong password on a protected session shows the generic error and lets the reader retry', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const { ciphertext, encParams } = await encryptPayload(JSON.stringify(validPayload), 'correct-horse')
    const encEnvelope = { ...validEnvelope, encrypted: true, payload: ciphertext, encParams }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(encEnvelope))))

    render(<SessionPage />)
    await waitFor(() => expect(screen.getByText('Protected session')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'totally-wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => expect(screen.getByText('Wrong password or corrupted data.')).toBeInTheDocument())
    expect(screen.queryByText('Test Doc')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('Save button opens SaveModal, and a plain save shows the saved chip without losing the doc', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(validEnvelope))))

    render(<SessionPage />)
    await waitFor(() => expect(screen.getByText('Test Doc')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = screen.getByRole('dialog', { name: 'Save this doc' })

    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Save' })))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Save this doc' })).not.toBeInTheDocument())
    // The doc must still be rendered -- encrypt/plain save must never blank the reader.
    expect(screen.getByText('Test Doc')).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('saved')).toBeInTheDocument()
  })

  it('an encrypt save keeps the CURRENT decrypted payload on screen (does not drop to the protected-session card)', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(validEnvelope))))

    render(<SessionPage />)
    await waitFor(() => expect(screen.getByText('Test Doc')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = screen.getByRole('dialog', { name: 'Save this doc' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Save this doc' })).not.toBeInTheDocument(),
    )
    // Must still show the live document, never the "Protected session" placeholder.
    expect(screen.getByText('Test Doc')).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.queryByText(/Protected session/i)).not.toBeInTheDocument()
    expect(screen.getByText('saved')).toBeInTheDocument()
  })
})
