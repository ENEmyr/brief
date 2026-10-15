'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import type { Block } from '@brief/schema'
import { decryptImage } from '@/features/save'
import { API_URL } from '@/shared/api'
import { BlockCard, cardHeader, type BlockCardState } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'

type ImageBlockData = Extract<Block, { type: 'image' }>

/** The unlocked session's key, or null for a plain brief. SessionView provides it. */
export const ImageKeyContext = createContext<CryptoKey | null>(null)

type ImageLoad = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'missing' }

const MISSING: BlockCardState = { status: 'error', message: 'Image is missing or has expired.' }
const READY: BlockCardState = { status: 'ready' }

/**
 * The served type says what the bytes are: the image API stores ciphertext as
 * application/octet-stream and a plain image under its sniffed image type. A
 * protected brief saved before its images were re-encrypted still serves them
 * plain, so the brief's own lock does not decide the path.
 */
async function loadImage(imageId: string, key: CryptoKey | null): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/image/${encodeURIComponent(imageId)}`)
  if (!res.ok) throw new Error('Image not served.')
  const blob = await res.blob()
  if (blob.type !== 'application/octet-stream') return blob
  if (key === null) throw new Error('Encrypted image without a key.')
  return new Blob([await decryptImage(await blob.arrayBuffer(), key)])
}

export function ImageBlock({ block, ...anchor }: { block: ImageBlockData } & BlockAnchor) {
  const key = useContext(ImageKeyContext)
  return <ImageCard key={block.imageId} block={block} imageKey={key} anchor={anchor} />
}

function ImageCard({
  block,
  imageKey,
  anchor,
}: {
  block: ImageBlockData
  imageKey: CryptoKey | null
  anchor: BlockAnchor
}) {
  const [load, setLoad] = useState<ImageLoad>({ status: 'loading' })

  useEffect(() => {
    let live = true
    let url: string | null = null
    loadImage(block.imageId, imageKey).then(
      (blob) => {
        if (!live) return
        url = URL.createObjectURL(blob)
        setLoad({ status: 'ready', url })
      },
      () => {
        if (live) setLoad({ status: 'missing' })
      },
    )
    return () => {
      live = false
      if (url !== null) URL.revokeObjectURL(url)
    }
  }, [block.imageId, imageKey])

  const sized = block.width !== undefined && block.height !== undefined
  // No header "loading" label: it wraps the header at phone width, and the
  // header shrinking on load would shift the card the box was reserved for.
  return (
    <BlockCard {...cardHeader(block, anchor)} state={load.status === 'missing' ? MISSING : READY}>
      <div data-image-body className="p-3">
        <div
          className={`mx-auto max-w-full ${sized || load.status !== 'ready' ? '' : 'w-fit'}`}
          style={sized ? { width: block.width, aspectRatio: `${block.width} / ${block.height}` } : undefined}
        >
          {load.status === 'ready' ? (
            <img
              src={load.url}
              alt={block.alt}
              width={block.width}
              height={block.height}
              onError={() => setLoad({ status: 'missing' })}
              className={sized ? 'block size-full' : 'block h-auto max-w-full'}
            />
          ) : (
            <div data-image-loading aria-hidden="true" className={`sk rounded-[4px] ${sized ? 'h-full' : 'h-32'}`} />
          )}
        </div>
      </div>
    </BlockCard>
  )
}
