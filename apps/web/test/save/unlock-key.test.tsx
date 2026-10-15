import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { EncParams, Payload } from '@brief/schema'
import { UnlockCard } from '@/features/save/components/UnlockCard'
import { decryptPayload, deriveSessionKey } from '@/features/save/lib/crypto'

vi.mock('@/features/save/lib/crypto', () => ({
  decryptPayload: vi.fn(),
  deriveSessionKey: vi.fn(),
}))

const encParams: EncParams = { salt: 'salt', iv: 'iv', iterations: 600_000 }
const payload: Payload = {
  meta: { title: 'Secret Doc' },
  sections: [{ id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello world' }] }],
  decisions: [],
}
const key = { type: 'secret' } as CryptoKey

afterEach(() => vi.clearAllMocks())

function unlock(password: string) {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
}

describe('UnlockCard onKey', () => {
  it('hands the session key to onKey before onUnlock', async () => {
    vi.mocked(decryptPayload).mockResolvedValue(JSON.stringify(payload))
    vi.mocked(deriveSessionKey).mockResolvedValue(key)
    const calls: string[] = []
    const onKey = vi.fn(() => calls.push('key'))
    const onUnlock = vi.fn(() => calls.push('unlock'))
    render(<UnlockCard ciphertext="c" encParams={encParams} onUnlock={onUnlock} onKey={onKey} />)
    unlock('right')

    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith(payload))
    expect(onKey).toHaveBeenCalledWith(key)
    expect(deriveSessionKey).toHaveBeenCalledWith('right', encParams)
    expect(calls).toEqual(['key', 'unlock'])
  })

  it('hands out no key on a wrong password', async () => {
    vi.mocked(decryptPayload).mockRejectedValue(new DOMException('fail', 'OperationError'))
    vi.mocked(deriveSessionKey).mockResolvedValue(key)
    const onKey = vi.fn()
    render(<UnlockCard ciphertext="c" encParams={encParams} onUnlock={vi.fn()} onKey={onKey} />)
    unlock('wrong')

    expect(await screen.findByText('Wrong password or corrupted data.')).toBeInTheDocument()
    expect(onKey).not.toHaveBeenCalled()
  })

  it('derives no key when nobody asks for one', async () => {
    vi.mocked(decryptPayload).mockResolvedValue(JSON.stringify(payload))
    const onUnlock = vi.fn()
    render(<UnlockCard ciphertext="c" encParams={encParams} onUnlock={onUnlock} />)
    unlock('right')

    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith(payload))
    expect(deriveSessionKey).not.toHaveBeenCalled()
  })
})
