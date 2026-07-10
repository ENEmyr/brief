import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { EncParams, Payload } from '@brief/schema'
import { UnlockCard } from '@/features/save/components/UnlockCard'
import { decryptPayload } from '@/features/save/lib/crypto'

vi.mock('@/features/save/lib/crypto', () => ({
  decryptPayload: vi.fn(),
}))

const mockDecrypt = vi.mocked(decryptPayload)

const encParams: EncParams = { salt: 'salt', iv: 'iv', iterations: 600_000 }

const validPayload: Payload = {
  meta: { title: 'Secret Doc' },
  sections: [{ id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello world' }] }],
  decisions: [],
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('UnlockCard', () => {
  it('renders the protected-session copy and a password form, no stub text', () => {
    render(<UnlockCard ciphertext="cipher" encParams={encParams} onUnlock={vi.fn()} />)

    expect(screen.getByText('Protected session')).toBeInTheDocument()
    expect(screen.getByText(/end-to-end encrypted/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument()
    expect(screen.queryByText(/arrives in a later release/i)).not.toBeInTheDocument()
  })

  it('focuses the password field on mount', () => {
    render(<UnlockCard ciphertext="cipher" encParams={encParams} onUnlock={vi.fn()} />)
    expect(screen.getByLabelText('Password')).toHaveFocus()
  })

  it('calls decryptPayload with the entered password and unlocks on success', async () => {
    mockDecrypt.mockResolvedValue(JSON.stringify(validPayload))
    const onUnlock = vi.fn()
    render(<UnlockCard ciphertext="cipher-text" encParams={encParams} onUnlock={onUnlock} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith(validPayload))
    expect(mockDecrypt).toHaveBeenCalledWith('cipher-text', 'correct-horse', encParams)
  })

  it('submits on Enter (native form submit)', async () => {
    mockDecrypt.mockResolvedValue(JSON.stringify(validPayload))
    const onUnlock = vi.fn()
    render(<UnlockCard ciphertext="cipher" encParams={encParams} onUnlock={onUnlock} />)

    const input = screen.getByLabelText('Password')
    fireEvent.change(input, { target: { value: 'correct-horse' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith(validPayload))
  })

  it('shows a busy "Decrypting…" disabled state while the decrypt is in flight', async () => {
    let resolveDecrypt: (v: string) => void
    mockDecrypt.mockReturnValue(new Promise((resolve) => (resolveDecrypt = resolve)))
    render(<UnlockCard ciphertext="cipher" encParams={encParams} onUnlock={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    const busyButton = await screen.findByRole('button', { name: 'Decrypting…' })
    expect(busyButton).toBeDisabled()
    expect(screen.getByLabelText('Password')).toBeDisabled()

    resolveDecrypt!(JSON.stringify(validPayload))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Decrypting…' })).not.toBeInTheDocument())
  })

  it('wrong password: decryptPayload rejecting shows the generic error, clears input, and allows retry', async () => {
    mockDecrypt.mockRejectedValueOnce(new Error('OperationError'))
    render(<UnlockCard ciphertext="cipher" encParams={encParams} onUnlock={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => expect(screen.getByText('Wrong password or corrupted data.')).toBeInTheDocument())
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.getByLabelText('Password')).not.toBeDisabled()

    // Retry with the correct password succeeds and clears the error.
    mockDecrypt.mockResolvedValueOnce(JSON.stringify(validPayload))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'right-pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => expect(screen.queryByText('Wrong password or corrupted data.')).not.toBeInTheDocument())
    expect(mockDecrypt).toHaveBeenLastCalledWith('cipher', 'right-pw', encParams)
  })

  it('corrupt JSON path: decryptPayload resolves but JSON.parse fails -- same generic error', async () => {
    mockDecrypt.mockResolvedValue('not json{{{')
    render(<UnlockCard ciphertext="cipher" encParams={encParams} onUnlock={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => expect(screen.getByText('Wrong password or corrupted data.')).toBeInTheDocument())
  })

  it('schema-invalid payload path: valid JSON but fails payloadSchema -- same generic error, indistinguishable from wrong password', async () => {
    mockDecrypt.mockResolvedValue(JSON.stringify({ not: 'a payload' }))
    const onUnlock = vi.fn()
    render(<UnlockCard ciphertext="cipher" encParams={encParams} onUnlock={onUnlock} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => expect(screen.getByText('Wrong password or corrupted data.')).toBeInTheDocument())
    expect(onUnlock).not.toHaveBeenCalled()
  })

  it('the error region is aria-live polite', async () => {
    mockDecrypt.mockRejectedValueOnce(new Error('fail'))
    render(<UnlockCard ciphertext="cipher" encParams={encParams} onUnlock={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => {
      const err = screen.getByText('Wrong password or corrupted data.')
      expect(err.closest('[aria-live="polite"]')).not.toBeNull()
    })
  })

  it('the password never appears anywhere in the DOM after a submit (success or failure)', async () => {
    mockDecrypt.mockRejectedValueOnce(new Error('fail'))
    const { container } = render(<UnlockCard ciphertext="cipher" encParams={encParams} onUnlock={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'super-secret-pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => expect(screen.getByText('Wrong password or corrupted data.')).toBeInTheDocument())
    expect(container.innerHTML).not.toContain('super-secret-pw')
  })
})
