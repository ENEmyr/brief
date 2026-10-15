import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { BlockRenderer } from '@/features/reader'
import { ImageKeyContext } from '@/features/reader/components/blocks/ImageBlock'
import { deriveSessionKey, encryptImage } from '@/features/save'
import { API_URL } from '@/shared/api'

const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.codePointAt(0)!,
)

const image: Extract<Block, { type: 'image' }> = {
  type: 'image',
  imageId: 'img_4f9Kq2xZ7bN1aaaa',
  alt: 'p95 latency per day',
  caption: 'Figure 1',
  width: 1200,
  height: 640,
}

// A fetched blob comes from Node's Response and has arrayBuffer(); a blob the
// block builds comes from jsdom, which only FileReader can read.
const bytesOf = (blob: Blob) =>
  typeof blob.arrayBuffer === 'function'
    ? blob.arrayBuffer().then((buffer) => new Uint8Array(buffer))
    : new Promise<Uint8Array>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
        reader.readAsArrayBuffer(blob)
      })

const served = (body: BodyInit, type: string) => new Response(body, { status: 200, headers: { 'content-type': type } })

let created: Blob[]
let revoked: string[]

beforeEach(() => {
  created = []
  revoked = []
  vi.stubGlobal(
    'URL',
    Object.assign(globalThis.URL, {
      createObjectURL: (blob: Blob) => {
        created.push(blob)
        return `blob:test/${created.length}`
      },
      revokeObjectURL: (url: string) => {
        revoked.push(url)
      },
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

describe('ImageBlock', () => {
  it('fetches the image by id and shows it with its alt and caption in the block card', async () => {
    const fetchMock = vi.fn().mockResolvedValue(served(PNG, 'image/png'))
    vi.stubGlobal('fetch', fetchMock)
    render(<BlockRenderer block={image} />)

    const img = await screen.findByRole('img', { name: 'p95 latency per day' })
    expect(img).toHaveAttribute('src', 'blob:test/1')
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/image/img_4f9Kq2xZ7bN1aaaa`)
    expect(screen.getByText('Figure 1')).toBeInTheDocument()
    expect(await bytesOf(created[0]!)).toEqual(PNG)
  })

  it('reserves the box from width and height before the bytes arrive', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    const { container } = render(<BlockRenderer block={image} />)

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('[data-image-loading]')).not.toBeNull()
    const box = container.querySelector('[data-image-body] > div') as HTMLElement
    expect(box.style.width).toBe('1200px')
    expect(box.style.aspectRatio).toBe('1200 / 640')
  })

  it('shows the fixed missing message, never an img, when the API answers 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"Image not found or expired."}', { status: 404 })))
    render(<BlockRenderer block={image} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Image is missing or has expired.')
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByText(/not found or expired/)).toBeNull()
  })

  it('decrypts an octet-stream image with the session key', async () => {
    const encParams = { salt: btoa('0123456789abcdef'), iv: btoa('0123456789ab'), iterations: 1000 }
    const key = await deriveSessionKey('pw', encParams)
    const ciphertext = await encryptImage(PNG, key)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(served(ciphertext, 'application/octet-stream')))
    render(
      <ImageKeyContext.Provider value={key}>
        <BlockRenderer block={image} />
      </ImageKeyContext.Provider>,
    )

    await screen.findByRole('img', { name: 'p95 latency per day' })
    expect(await bytesOf(created[0]!)).toEqual(PNG)
  })

  it('shows the missing message for ciphertext when the reader holds no key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(served(new Uint8Array(64), 'application/octet-stream')))
    render(<BlockRenderer block={image} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Image is missing or has expired.')
    expect(created).toEqual([])
  })

  it('shows the missing message when the key does not decrypt the image', async () => {
    const encParams = { salt: btoa('0123456789abcdef'), iv: btoa('0123456789ab'), iterations: 1000 }
    const ciphertext = await encryptImage(PNG, await deriveSessionKey('right', encParams))
    const wrong = await deriveSessionKey('wrong', encParams)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(served(ciphertext, 'application/octet-stream')))
    render(
      <ImageKeyContext.Provider value={wrong}>
        <BlockRenderer block={image} />
      </ImageKeyContext.Provider>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Image is missing or has expired.')
  })

  it('revokes the object URL when the block unmounts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(served(PNG, 'image/png')))
    const { unmount } = render(<BlockRenderer block={image} />)
    await screen.findByRole('img')

    expect(revoked).toEqual([])
    unmount()
    expect(revoked).toEqual(['blob:test/1'])
  })

  it('renders the alt and caption of a hostile payload as text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(served(PNG, 'image/png')))
    const xss = '<img src=x onerror=alert(1)>'
    const { container } = render(<BlockRenderer block={{ ...image, alt: xss, caption: xss }} />)

    expect(await screen.findByRole('img', { name: xss })).toBeInTheDocument()
    expect(screen.getByText(xss)).toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })
})

describe('encryptImage and decryptImage', () => {
  it('round-trips bytes with the IV carried in the blob', async () => {
    const { decryptImage } = await import('@/features/save')
    const encParams = { salt: btoa('0123456789abcdef'), iv: btoa('0123456789ab'), iterations: 1000 }
    const key = await deriveSessionKey('pw', encParams)
    const blob = await encryptImage(PNG, key)

    expect(blob.byteLength).toBe(12 + PNG.byteLength + 16)
    expect(new Uint8Array(await decryptImage(blob.buffer, key))).toEqual(PNG)
  })
})
