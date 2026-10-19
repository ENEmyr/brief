import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Payload } from '@brief/schema'
import { SaveModal } from '@/features/save/components/SaveModal'
import { decryptPayloadWithKey, deriveSessionKey } from '@/features/save/lib/crypto'
import { imageIdsIn } from '@/features/save/lib/images'
import { ExportProvider } from '@/features/export'
import { ReaderStateProvider } from '@/features/reader-state'

const API_URL = 'http://localhost:8787'
const PASSWORD = 'password123'
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

const payload: Payload = {
  meta: { title: 'Images' },
  sections: [
    {
      id: 's1',
      no: 1,
      title: 'Charts',
      blocks: [
        { type: 'image', imageId: 'img_top0000000000001', alt: 'top' },
        { type: 'image', imageId: 'img_second0000000001', alt: 'second' },
      ],
    },
  ],
  decisions: [],
}

const png = () => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } })
const sealed = (n: number) => new Response(JSON.stringify({ imageId: `img_sealed00000000${n}` }), { status: 201 })

// Every request in order, as "METHOD url".
function stubApi(route: (url: string, method: string) => Response | Promise<Response> | undefined) {
  const log: string[] = []
  const saves: string[] = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    log.push(`${method} ${url}`)
    if (method === 'PUT') saves.push(init!.body as string)
    return (await route(url, method)) ?? new Response(JSON.stringify({ state: null }), { status: 200 })
  })
  return { deletes: () => log.filter((line) => line.startsWith('DELETE ')), log, saves }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function archiveWithPassword() {
  const onSaved = vi.fn()
  render(
    <ReaderStateProvider sessionId="sess1">
      <ExportProvider sessionId="sess1" payload={payload}>
        <SaveModal sessionId="sess1" storedJson={JSON.stringify(payload)} onClose={vi.fn()} onSaved={onSaved} />
      </ExportProvider>
    </ReaderStateProvider>,
  )
  fireEvent.click(screen.getByRole('radio', { name: 'Archive with password' }))
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: PASSWORD } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: PASSWORD } })
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
  return { onSaved }
}

describe('encrypted copies of a failed or cancelled archive', () => {
  it('deletes exactly the copies a failed attempt uploaded, and a Retry then archives', async () => {
    let uploads = 0
    const api = stubApi((url, method) => {
      if (method === 'GET' && url.startsWith(`${API_URL}/api/image/`)) return png()
      if (method === 'POST' && url === `${API_URL}/api/session/sess1/image`) {
        uploads++
        return uploads === 2 ? new Response(JSON.stringify({ error: 'Internal error.' }), { status: 500 }) : sealed(uploads)
      }
      if (method === 'DELETE') return new Response(null, { status: 204 })
      if (method === 'PUT') return new Response(JSON.stringify({ saved: true }), { status: 200 })
      return undefined
    })
    const { onSaved } = archiveWithPassword()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not archive. Nothing was changed.'))
    await waitFor(() => expect(api.deletes()).toEqual([`DELETE ${API_URL}/api/session/sess1/image/img_sealed000000001`]))

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('encrypt'))

    expect(api.deletes()).toEqual([`DELETE ${API_URL}/api/session/sess1/image/img_sealed000000001`])
    const put = api.log.indexOf(`PUT ${API_URL}/api/session/sess1/save`)
    expect(api.log.slice(put - 4, put)).toEqual([
      `GET ${API_URL}/api/image/img_top0000000000001`,
      `POST ${API_URL}/api/session/sess1/image`,
      `GET ${API_URL}/api/image/img_second0000000001`,
      `POST ${API_URL}/api/session/sess1/image`,
    ])
    const body = JSON.parse(api.saves[0]!)
    const saved = await decryptPayloadWithKey(body.ciphertext, await deriveSessionKey(PASSWORD, body.encParams), body.encParams)
    expect(imageIdsIn(saved)).toEqual(['img_sealed000000003', 'img_sealed000000004'])
  })

  it('deletes the copies when the API refuses the save, but not when the save never got an answer', async () => {
    let saveStatus = 500
    const api = stubApi((url, method) => {
      if (method === 'GET' && url.startsWith(`${API_URL}/api/image/`)) return png()
      if (method === 'POST') return sealed(api.log.filter((line) => line.startsWith('POST ')).length)
      if (method === 'DELETE') return new Response(null, { status: 204 })
      if (method === 'PUT') {
        if (saveStatus === 0) throw new TypeError('Failed to fetch')
        return new Response(JSON.stringify({ error: 'Internal error.' }), { status: saveStatus })
      }
      return undefined
    })
    archiveWithPassword()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not archive. Nothing was changed.'))
    await waitFor(() =>
      expect(api.deletes()).toEqual([
        `DELETE ${API_URL}/api/session/sess1/image/img_sealed000000001`,
        `DELETE ${API_URL}/api/session/sess1/image/img_sealed000000002`,
      ]),
    )

    saveStatus = 0
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(api.log.filter((line) => line.startsWith('PUT '))).toHaveLength(2))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(api.deletes()).toHaveLength(2)
  })

  it('deletes the copy uploaded before a cancel, and a failed delete shows nothing new', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let finishUpload: (response: Response) => void = () => {}
    const api = stubApi((url, method) => {
      if (method === 'GET' && url.startsWith(`${API_URL}/api/image/`)) return png()
      if (method === 'POST') return new Promise((resolve) => (finishUpload = resolve))
      if (method === 'DELETE') return new Response(JSON.stringify({ error: 'Internal error.' }), { status: 500 })
      return undefined
    })
    archiveWithPassword()

    await waitFor(() => expect(api.log).toContain(`POST ${API_URL}/api/session/sess1/image`))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    finishUpload(sealed(1))

    await waitFor(() => expect(api.deletes()).toEqual([`DELETE ${API_URL}/api/session/sess1/image/img_sealed000000001`]))
    await waitFor(() => expect(warn).toHaveBeenCalled())
    expect(api.log.filter((line) => line.startsWith('POST '))).toHaveLength(1)
    expect(api.log.filter((line) => line.startsWith('PUT '))).toHaveLength(0)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
