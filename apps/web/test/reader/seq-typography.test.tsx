import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import type { Block } from '@brief/schema'

/**
 * The real payload that broke the block: seven actors, Thai names of very
 * different lengths, and long Thai sentences as step labels. Thai has no word
 * spaces, so it exercises both the sizing and the wrapping paths that a Latin
 * fixture leaves untouched.
 */
const THAI_ACTORS = ['พนักงาน', 'DM', 'SLM', 'ผอ.สำนัก C9', 'HR', 'คณะกรรมการ', 'Payroll']

const LONG_SELF_LABEL = 'ประเมินตนเองรายข้อ 1-5 + แนบหลักฐาน + ตรวจทาน + ติ๊กยืนยัน'
const LONG_CROSS_LABEL = 'ทบทวนเทียบ self รายข้อ ปรับคะแนน ใส่ความเห็น ส่งต่อ'
const BOARD_LABEL = 'มติขั้นสุดท้ายในกรอบงบ 6.5% ต่อสำนัก (ประชุมนอกระบบ)'

const thaiSeq: Extract<Block, { type: 'seq' }> = {
  type: 'seq',
  title: 'รอบประเมินประจำปี',
  actors: THAI_ACTORS,
  steps: [
    { from: 'พนักงาน', to: 'พนักงาน', label: LONG_SELF_LABEL },
    { from: 'พนักงาน', to: 'DM', label: 'ส่งแบบประเมินให้หัวหน้างาน' },
    { from: 'DM', to: 'SLM', label: LONG_CROSS_LABEL },
    { from: 'SLM', to: 'ผอ.สำนัก C9', label: 'กลั่นกรองระดับสำนัก' },
    { from: 'ผอ.สำนัก C9', to: 'HR', label: 'ส่งผลรวมเข้าระบบ HR' },
    { from: 'HR', to: 'คณะกรรมการ', label: 'เสนอที่ประชุมพิจารณา' },
    { from: 'คณะกรรมการ', to: 'คณะกรรมการ', label: BOARD_LABEL },
    { from: 'คณะกรรมการ', to: 'Payroll', label: 'ส่งผลขึ้นเงินเดือนเข้าระบบจ่ายเงิน' },
  ],
}

function renderSeq(block: Extract<Block, { type: 'seq' }>): SVGSVGElement {
  const { container } = render(<BlockRenderer block={block} />)
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('no svg rendered')
  return svg as SVGSVGElement
}

/** Actor groups come first in document order, one <g> per actor. */
function actorGroups(svg: SVGSVGElement, count: number): Element[] {
  return Array.from(svg.querySelectorAll(':scope > g')).slice(0, count)
}

function num(el: Element | null | undefined, attr: string): number {
  return Number(el?.getAttribute(attr) ?? NaN)
}

/**
 * Zero-advance Thai marks (vowels above/below, tone marks) do not consume
 * horizontal space, so a floor on the pill width must not count them.
 */
function advanceChars(text: string): number {
  return Array.from(text).filter((ch) => !/[ัิ-ฺ็-๎]/.test(ch)).length
}

describe('Seq typography and sizing (Thai payload)', () => {
  it('renders at its natural pixel size and never upscales', () => {
    const svg = renderSeq(thaiSeq)

    expect(svg.style.maxWidth).toBe('100%')
    // The upscale bug: `width: 100%` on a small fixed viewBox stretched one user
    // unit to ~1.8 CSS pixels. The diagram must only ever be scaled down.
    expect(svg.style.width).toBe('')
    expect(svg.style.height).toBe('auto')
    expect(num(svg, 'width')).toBeGreaterThan(0)
    expect(num(svg, 'height')).toBeGreaterThan(0)
    // The viewBox matches the rendered size 1:1, so one user unit is one CSS
    // pixel and an 11-unit label paints at 11px instead of the old ~20px.
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${num(svg, 'width')} ${num(svg, 'height')}`)
  })

  it('grows the diagram width with the actor count instead of squeezing a fixed box', () => {
    const three = renderSeq({ ...thaiSeq, actors: THAI_ACTORS.slice(0, 3), steps: thaiSeq.steps.slice(0, 3) })
    const seven = renderSeq(thaiSeq)
    expect(num(seven, 'width')).toBeGreaterThan(num(three, 'width'))
  })

  it('sizes each actor pill to its own name, so no name overflows an empty-looking box', () => {
    const svg = renderSeq(thaiSeq)
    const groups = actorGroups(svg, THAI_ACTORS.length)
    expect(groups).toHaveLength(THAI_ACTORS.length)

    const widths = groups.map((g) => num(g.querySelector('rect'), 'width'))
    // Size-to-fit: a long name gets a wider pill than a short one.
    expect(new Set(widths).size).toBeGreaterThan(1)
    expect(widths[THAI_ACTORS.indexOf('คณะกรรมการ')]).toBeGreaterThan(widths[THAI_ACTORS.indexOf('DM')] as number)

    groups.forEach((g, i) => {
      const name = THAI_ACTORS[i] as string
      const text = g.querySelector('text')
      expect(text?.textContent).toBe(name)
      const fontSize = Number(text?.getAttribute('font-size'))
      // Every glyph of the name fits inside its pill, at a conservative 0.6em
      // advance per advance-bearing character.
      expect(widths[i] as number).toBeGreaterThanOrEqual(advanceChars(name) * fontSize * 0.6)
    })
  })

  it('keeps neighbouring actor pills from colliding', () => {
    const svg = renderSeq(thaiSeq)
    const rects = actorGroups(svg, THAI_ACTORS.length).map((g) => g.querySelector('rect'))
    for (let i = 1; i < rects.length; i++) {
      const prev = rects[i - 1]
      const cur = rects[i]
      const prevRight = num(prev, 'x') + num(prev, 'width')
      expect(num(cur, 'x')).toBeGreaterThan(prevRight)
    }
  })

  it('wraps a long Thai label into several tspans instead of one overflowing line', () => {
    const svg = renderSeq(thaiSeq)
    const texts = Array.from(svg.querySelectorAll('text'))
    const wrapped = texts.filter((t) => t.querySelectorAll('tspan').length > 1)
    expect(wrapped.length).toBeGreaterThan(0)

    const strip = (s: string) => s.replace(/\s+/g, '')
    const longest = texts.find((t) => strip(t.textContent ?? '').includes(strip(LONG_SELF_LABEL).slice(0, 12)))
    expect(longest).toBeTruthy()
    const lines = Array.from(longest?.querySelectorAll('tspan') ?? []).map((t) => t.textContent ?? '')
    expect(lines.length).toBeGreaterThan(1)
    // Wrapping only inserts breaks: no character of the label is lost.
    expect(strip(lines.join(''))).toBe(strip(LONG_SELF_LABEL))
  })

  it('rows are pitched to the tallest wrapped label, so labels do not overlap', () => {
    const svg = renderSeq(thaiSeq)
    const arrowRows = Array.from(svg.querySelectorAll('line:not([stroke-dasharray="3 3"])')).map((l) => num(l, 'y1'))
    for (let i = 1; i < arrowRows.length; i++) {
      // The old layout used a fixed 30-unit pitch, which cannot hold a label
      // wrapped onto three or four lines.
      expect(arrowRows[i] as number).toBeGreaterThan(arrowRows[i - 1] as number)
    }
    const tallest = Math.max(
      ...Array.from(svg.querySelectorAll('text')).map((t) => t.querySelectorAll('tspan').length),
    )
    expect(num(svg, 'height')).toBeGreaterThan(30 * thaiSeq.steps.length)
    expect(tallest).toBeGreaterThan(1)
  })

  it('draws every label with a Thai-capable font stack, applied through the style prop', () => {
    const svg = renderSeq(thaiSeq)
    const texts = Array.from(svg.querySelectorAll('text'))
    expect(texts.length).toBeGreaterThan(0)

    texts.forEach((t) => {
      // A presentation attribute cannot resolve var(), so the stack has to ride
      // on the style prop.
      expect(t.getAttribute('font-family')).toBeNull()
      const family = (t as SVGTextElement).style.fontFamily
      expect(family).toContain('--font-plex-sans')
      expect(family).toContain('IBM Plex Sans Thai')
    })
  })

  it('still shows every actor name and the step controls', () => {
    render(<BlockRenderer block={thaiSeq} />)
    THAI_ACTORS.forEach((a) => expect(screen.getAllByText(a).length).toBeGreaterThan(0))
    expect(screen.getByText(`step ${thaiSeq.steps.length}/${thaiSeq.steps.length}`)).toBeInTheDocument()
  })
})

describe('Sibling diagram blocks use the shared Thai-capable text style', () => {
  it('state, layers and erd labels carry the font stack on the style prop', () => {
    const blocks: Block[] = [
      {
        type: 'state',
        initial: 'a',
        states: [
          { id: 'a', label: 'รอดำเนินการ' },
          { id: 'b', label: 'เสร็จสิ้น' },
        ],
        transitions: [{ from: 'a', to: 'b', label: 'ไป' }],
      },
      {
        type: 'layers',
        layers: [
          {
            id: 'db',
            label: 'ฐานข้อมูล',
            nodes: [{ id: 'n1', label: 'ตารางพนักงาน' }],
            edges: [],
          },
        ],
      },
      {
        type: 'erd',
        tables: [{ name: 'พนักงาน', columns: [{ name: 'รหัส', type: 'text', pk: true }] }],
      },
    ]

    blocks.forEach((block) => {
      const { container, unmount } = render(<BlockRenderer block={block} />)
      const texts = Array.from(container.querySelectorAll('svg text'))
      expect(texts.length).toBeGreaterThan(0)
      texts.forEach((t) => {
        expect(t.getAttribute('font-family')).toBeNull()
        expect((t as SVGTextElement).style.fontFamily).toContain('IBM Plex Sans Thai')
      })
      unmount()
    })
  })
})
