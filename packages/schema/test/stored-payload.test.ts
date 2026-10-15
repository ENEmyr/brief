import { describe, it, expect } from 'vitest'
import { parseStoredPayload, serializeStoredPayload } from '../src'

const stored = (blocks: unknown[]) => ({
  meta: { title: 'Stored' },
  sections: [{ id: 's', no: 1, title: 'S', blocks }],
  decisions: [],
})

describe('parseStoredPayload', () => {
  it('keeps readable blocks and wraps the rest verbatim, inside details too', () => {
    const hologram = { type: 'hologram', frames: 3 }
    const tooWide = { type: 'table', head: [], rows: [['x']] }
    const parsed = parseStoredPayload(stored([
      { type: 'p', text: 'kept' },
      hologram,
      tooWide,
      { type: 'details', summary: 'More', blocks: [{ type: 'p', text: 'inner' }, hologram] },
    ]))
    expect(parsed.sections[0]!.blocks).toEqual([
      { type: 'p', text: 'kept' },
      { type: 'unreadable', raw: hologram },
      { type: 'unreadable', raw: tooWide },
      { type: 'details', summary: 'More', blocks: [{ type: 'p', text: 'inner' }, { type: 'unreadable', raw: hologram }] },
    ])
  })

  it('writes every unreadable block back as the JSON it was read from', () => {
    const original = stored([
      { type: 'p', text: 'kept' },
      { type: 'hologram', frames: 3 },
      { type: 'details', summary: 'More', blocks: [{ type: 'p', text: 'inner' }, { type: 'hologram', frames: 4 }] },
    ])
    expect(JSON.parse(serializeStoredPayload(parseStoredPayload(original)))).toEqual(original)
  })

  it('still rejects a payload whose damage is outside the blocks', () => {
    expect(() => parseStoredPayload({ ...stored([{ type: 'p', text: 'x' }]), meta: {} })).toThrow()
  })
})
