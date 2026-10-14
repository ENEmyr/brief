import { describe, it, expect, afterEach } from 'vitest'
import { adjacentSectionId, findSection } from '@/features/reader/lib/sectionNav'

// Lays out three section cards with a 72px scroll margin at the given
// viewport tops, inside the document column (`main`), plus a decision
// section outside it that J and K must never land on.
function layout(tops: number[]) {
  document.body.innerHTML = `
    <main>${tops.map((_, i) => `<section data-section="s${i + 1}" style="scroll-margin-top: 72px"></section>`).join('')}</main>
    <aside><section data-section="decide"></section></aside>
  `
  document.querySelectorAll<HTMLElement>('main [data-section]').forEach((el, i) => {
    el.getBoundingClientRect = () => ({ top: tops[i]! }) as DOMRect
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('adjacentSectionId (J and K)', () => {
  it('J goes to the first card still below the scroll margin line', () => {
    layout([-300, 72, 600])
    expect(adjacentSectionId(1)).toBe('s3')
  })

  it('J from the top of the page goes to the first section', () => {
    layout([239, 700, 1200])
    expect(adjacentSectionId(1)).toBe('s1')
  })

  it('K goes to the start of the current section when it began above the line', () => {
    layout([-300, -40, 600])
    expect(adjacentSectionId(-1)).toBe('s2')
  })

  it('K from a card sitting on the line goes to the one before it', () => {
    layout([-300, 72, 600])
    expect(adjacentSectionId(-1)).toBe('s1')
  })

  it('returns null past either end', () => {
    layout([-900, -500, 72])
    expect(adjacentSectionId(1)).toBeNull()
    layout([239, 700, 1200])
    expect(adjacentSectionId(-1)).toBeNull()
  })

  it('findSection only finds sections the document column renders', () => {
    layout([0])
    expect(findSection('s1')).not.toBeNull()
    expect(findSection('decide')).toBeNull()
  })
})
