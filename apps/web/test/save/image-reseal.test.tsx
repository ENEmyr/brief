import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Payload } from '@brief/schema'
import { SaveModal } from '@/features/save/components/SaveModal'
import { decryptImage, decryptPayloadWithKey, deriveSessionKey } from '@/features/save/lib/crypto'
import { imageIdsIn, withImageIds } from '@/features/save/lib/images'
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
        { type: 'details', summary: 'More', blocks: [{ type: 'image', imageId: 'img_nested000000001', alt: 'nested' }] },
        { type: 'image', imageId: 'img_top0000000000001', alt: 'top again' },
      ],
    },
  ],
  decisions: [],
}

type Route = (url: string, init?: RequestInit) => Response | undefined

function stubApi(route: Route) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) =>
    Promise.resolve(route(url, init) ?? new Response(JSON.stringify({ state: null }), { status: 200 })),
  )
  vi.stubGlobal('fetch', fetchMock)
  const calls = (method: string, path: string) =>
    fetchMock.mock.calls.filter(
      ([url, init]) => (url as string).endsWith(path) && ((init as RequestInit | undefined)?.method ?? 'GET') === method,
    )
  return calls
}

// Bytes plus a content-type header: undici's Response does not read a jsdom Blob.
const png = () => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } })
const isImageGet = (url: string, init?: RequestInit) => url.startsWith(`${API_URL}/api/image/`) && !init?.method
const isUpload = (url: string, init?: RequestInit) => url === `${API_URL}/api/session/sess1/image` && init?.method === 'POST'

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

describe('image ids in the stored JSON', () => {
  it('lists top level and details ids once each, and rewrites both', () => {
    const stored = JSON.stringify(payload)
    expect(imageIdsIn(stored)).toEqual(['img_top0000000000001', 'img_nested000000001'])
    const rewritten = withImageIds(stored, new Map([['img_nested000000001', 'img_sealed000000001']]))
    expect(imageIdsIn(rewritten)).toEqual(['img_top0000000000001', 'img_sealed000000001'])
  })

  it('keeps every field and block this reader does not know', () => {
    const stored = JSON.stringify({
      meta: { title: 'Images' },
      futureTop: { n: 1 },
      sections: [
        {
          id: 's1',
          no: 1,
          title: 'Charts',
          blocks: [
            { type: 'image', imageId: 'img_top0000000000001', alt: 'top', futureCrop: [0, 0, 8, 8] },
            { type: 'hologram', frames: 3, imageId: 'img_holo00000000001' },
            { type: 'details', summary: 'More', blocks: [{ type: 'image', imageId: 'img_nested000000001', alt: 'nested' }] },
          ],
        },
      ],
      decisions: [],
    })
    const ids = new Map([
      ['img_top0000000000001', 'img_sealed000000001'],
      ['img_nested000000001', 'img_sealed000000002'],
    ])
    expect(imageIdsIn(stored)).toEqual(['img_top0000000000001', 'img_nested000000001'])
    expect(withImageIds(stored, ids)).toBe(
      stored.replace('img_top0000000000001', 'img_sealed000000001').replace('img_nested000000001', 'img_sealed000000002'),
    )
  })
})

describe('SaveModal encrypt path with images', () => {
  it('uploads each image encrypted with the payload key, then saves a payload naming the new ids', async () => {
    let next = 0
    const uploads: Uint8Array[] = []
    const calls = stubApi((url, init) => {
      if (isImageGet(url, init)) return png()
      if (isUpload(url, init)) {
        uploads.push(init!.body as Uint8Array)
        next++
        return new Response(JSON.stringify({ imageId: `img_sealed00000000${next}` }), { status: 201 })
      }
      if (init?.method === 'PUT') return new Response(JSON.stringify({ saved: true }), { status: 200 })
      return undefined
    })
    const { onSaved } = archiveWithPassword()
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('encrypt'))

    expect(uploads).toHaveLength(2)
    const body = JSON.parse(calls('PUT', '/api/session/sess1/save')[0]![1]!.body as string)
    const key = await deriveSessionKey(PASSWORD, body.encParams)
    const saved = await decryptPayloadWithKey(body.ciphertext, key, body.encParams)
    expect(imageIdsIn(saved)).toEqual(['img_sealed000000001', 'img_sealed000000002'])
    for (const upload of uploads) {
      expect(new Uint8Array(await decryptImage(upload.slice().buffer, key))).toEqual(PNG)
    }
  })

  it('a failed image upload stops before the save, with the fixed error and Retry', async () => {
    let next = 0
    const calls = stubApi((url, init) => {
      if (isImageGet(url, init)) return png()
      if (isUpload(url, init)) {
        next++
        return next === 1
          ? new Response(JSON.stringify({ imageId: 'img_sealed000000001' }), { status: 201 })
          : new Response(JSON.stringify({ error: 'Internal error.' }), { status: 500 })
      }
      return undefined
    })
    const { onSaved } = archiveWithPassword()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not archive. Nothing was changed.'))
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(calls('POST', '/api/session/sess1/image')).toHaveLength(2)
    expect(calls('PUT', '/api/session/sess1/save')).toHaveLength(0)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('a rate limited upload shows the 429 copy and saves nothing', async () => {
    const calls = stubApi((url, init) => {
      if (isImageGet(url, init)) return png()
      if (isUpload(url, init)) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429 })
      return undefined
    })
    archiveWithPassword()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many attempts - try again in a minute'))
    expect(calls('PUT', '/api/session/sess1/save')).toHaveLength(0)
  })

  it('keeps the id of an image the API no longer serves or already serves as ciphertext', async () => {
    const calls = stubApi((url, init) => {
      if (url.endsWith('img_top0000000000001') && !init?.method) return new Response('{}', { status: 404 })
      if (url.endsWith('img_nested000000001') && !init?.method) {
        return new Response(PNG, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
      }
      if (init?.method === 'PUT') return new Response(JSON.stringify({ saved: true }), { status: 200 })
      return undefined
    })
    const { onSaved } = archiveWithPassword()
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('encrypt'))

    expect(calls('POST', '/api/session/sess1/image')).toHaveLength(0)
    const body = JSON.parse(calls('PUT', '/api/session/sess1/save')[0]![1]!.body as string)
    const key = await deriveSessionKey(PASSWORD, body.encParams)
    const saved = await decryptPayloadWithKey(body.ciphertext, key, body.encParams)
    expect(imageIdsIn(saved)).toEqual(['img_top0000000000001', 'img_nested000000001'])
  })
})
