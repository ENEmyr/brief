import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockRenderer } from '@/features/reader'
import { ACTOR_WIDTH, LINE_HEIGHT, numberedLabel } from '@/features/reader/lib/seqLayout'
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

// Phase 4b draws the diagrams as the boards do (B-Blocks:78-98): HTML boxes
// and labels over one SVG edge layer, at natural size in a scrolling body.
// These tests pinned the old all-SVG drawing (rect, text, tspan); each now
// pins the same promise against the HTML structure.
function renderSeq(block: Extract<Block, { type: 'seq' }>): HTMLElement {
  const { container } = render(<BlockRenderer block={block} />)
  const canvas = container.querySelector<HTMLElement>('[data-actor]')?.parentElement
  if (!canvas) throw new Error('no diagram rendered')
  return canvas
}

const actors = (canvas: HTMLElement) => Array.from(canvas.querySelectorAll<HTMLElement>('[data-actor]'))
const labels = (canvas: HTMLElement) => Array.from(canvas.querySelectorAll<HTMLElement>('[data-seq-label]'))
const px = (value: string) => Number(value.replace('px', ''))

describe('Seq typography and sizing (Thai payload)', () => {
  it('renders at its natural pixel size and never upscales', () => {
    const canvas = renderSeq(thaiSeq)
    // The upscale bug: `width: 100%` on a small fixed viewBox stretched one unit
    // to ~1.8 CSS pixels. The canvas is sized in pixels and the edge layer's
    // viewBox matches it, so one unit is one pixel and nothing scales.
    expect(canvas.style.width).toMatch(/^\d+px$/)
    expect(canvas.style.height).toMatch(/^\d+px$/)
    const edges = canvas.querySelector('svg')
    expect(edges?.getAttribute('viewBox')).toBe(`0 0 ${px(canvas.style.width)} ${px(canvas.style.height)}`)
  })

  it('grows the diagram width with the actor count instead of squeezing a fixed box', () => {
    const three = renderSeq({ ...thaiSeq, actors: THAI_ACTORS.slice(0, 3), steps: thaiSeq.steps.slice(1, 3) })
    const seven = renderSeq(thaiSeq)
    expect(px(seven.style.width)).toBeGreaterThan(px(three.style.width))
  })

  it('draws every actor in the board box and grows it in height for a long name, so no name overflows', () => {
    // The board fixes actor boxes at 130x44 (B-Blocks:89-92); the old pills
    // were sized to their names instead. A name too long for 130 wraps, and
    // every box grows to the tallest name.
    const longName = 'ผู้อำนวยการสำนักบริหารทรัพยากรบุคคล'
    const canvas = renderSeq({ ...thaiSeq, actors: [...THAI_ACTORS, longName] })
    const boxes = actors(canvas)
    expect(boxes).toHaveLength(THAI_ACTORS.length + 1)
    boxes.forEach((box) => expect(box.style.width).toBe(`${ACTOR_WIDTH}px`))
    expect(new Set(boxes.map((b) => b.style.height)).size).toBe(1)
    expect(px(boxes[0]?.style.height ?? '')).toBeGreaterThan(44)
    expect(boxes.map((b) => b.textContent)).toEqual([...THAI_ACTORS, longName])
  })

  it('keeps neighbouring actor boxes from colliding', () => {
    const boxes = actors(renderSeq(thaiSeq))
    for (let i = 1; i < boxes.length; i++) {
      const prevRight = px(boxes[i - 1]?.style.left ?? '') + px(boxes[i - 1]?.style.width ?? '')
      expect(px(boxes[i]?.style.left ?? '')).toBeGreaterThan(prevRight)
    }
  })

  it('keeps boxes from colliding even when a name is long enough to wrap', () => {
    // These names are far wider than a 130px box. The box keeps its board
    // width and the name wraps inside it, so lanes never overlap.
    const longNameActors = [
      'ผู้อำนวยการสำนักบริหารทรัพยากรบุคคล',
      'คณะกรรมการพิจารณาผลการปฏิบัติงานประจำปี',
      'HR',
    ]
    const boxes = actors(
      renderSeq({
        type: 'seq',
        actors: longNameActors,
        steps: [
          { from: longNameActors[0] as string, to: longNameActors[1] as string, label: 'ส่ง' },
          { from: longNameActors[1] as string, to: longNameActors[2] as string, label: 'รับ' },
        ],
      }),
    )
    for (let i = 1; i < boxes.length; i++) {
      const prevRight = px(boxes[i - 1]?.style.left ?? '') + px(boxes[i - 1]?.style.width ?? '')
      expect(px(boxes[i]?.style.left ?? '')).toBeGreaterThan(prevRight)
    }
  })

  it('wraps a long Thai label onto several lines instead of one overflowing line', () => {
    const all = labels(renderSeq(thaiSeq))
    const longest = all.find((l) => (l.textContent ?? '').includes(LONG_SELF_LABEL.slice(0, 12)))
    const lines = (longest?.textContent ?? '').split('\n')
    expect(lines.length).toBeGreaterThan(1)
    // Wrapping only inserts breaks: no character of the numbered label is lost.
    const strip = (s: string) => s.replace(/\s+/g, '')
    expect(strip(lines.join(''))).toBe(strip(numberedLabel(0, LONG_SELF_LABEL)))
  })

  it('rows are pitched to the tallest wrapped label, so labels do not overlap', () => {
    const all = labels(renderSeq(thaiSeq))
    for (let i = 1; i < all.length; i++) {
      const prev = all[i - 1] as HTMLElement
      const prevBottom = px(prev.style.top) + (prev.textContent ?? '').split('\n').length * LINE_HEIGHT
      expect(px(all[i]?.style.top ?? '')).toBeGreaterThanOrEqual(prevBottom)
    }
  })

  it('sets labels as HTML text in the mono stack and names in the sans stack, both with Noto Sans Thai behind them', () => {
    // The labels used to be SVG text, which needed the font stack on the
    // style prop. As HTML they take the Tailwind stacks, and --font-sans and
    // --font-mono in globals.css both carry Noto Sans Thai.
    const canvas = renderSeq(thaiSeq)
    expect(canvas.querySelectorAll('svg text')).toHaveLength(0)
    expect(canvas.className).toContain('font-mono')
    actors(canvas).forEach((box) => expect(box.className).toContain('font-sans'))
  })

  it('still shows every actor name and the play control', () => {
    // The Prev/Next row with "step n/max" became the header controls (B-Blocks:75,
    // B-Reader:126): at rest the header shows Play.
    render(<BlockRenderer block={thaiSeq} />)
    THAI_ACTORS.forEach((a) => expect(screen.getAllByText(a).length).toBeGreaterThan(0))
    expect(screen.getByRole('button', { name: 'Play sequence' })).toBeInTheDocument()
  })
})

describe('Sibling diagram blocks set their labels as HTML text', () => {
  it('state, layers and erd draw no SVG text and show every Thai label', () => {
    // Same move as seq: nodes and labels are HTML (B-Blocks2:36-90), so the
    // font stack comes from CSS, not from an SVG style prop.
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
    const expected = [['รอดำเนินการ', 'เสร็จสิ้น', 'ไป'], ['ฐานข้อมูล', 'ตารางพนักงาน'], ['พนักงาน', 'รหัส']]

    blocks.forEach((block, i) => {
      const { container, unmount } = render(<BlockRenderer block={block} />)
      expect(container.querySelectorAll('svg text')).toHaveLength(0)
      expected[i]?.forEach((text) => expect(screen.getAllByText(text).length).toBeGreaterThan(0))
      unmount()
    })
  })
})
