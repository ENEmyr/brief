import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SessionPage from '@/app/s/page'

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

  it('shows protected-session card for encrypted sessions', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const encEnvelope = {
      ...validEnvelope,
      encrypted: true,
      payload: 'ciphertext',
      encParams: { salt: 'a', iv: 'b', iterations: 600_000 },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(encEnvelope))))

    render(<SessionPage />)

    await waitFor(() =>
      expect(screen.getByText(/Protected session/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/password unlock arrives in a later release/i)).toBeInTheDocument()
  })
})
