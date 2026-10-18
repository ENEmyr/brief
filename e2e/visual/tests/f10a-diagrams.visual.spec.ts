import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect, openReader, serveSession, test } from '../lib/session'

const diagrams: unknown = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '..', 'fixtures', 'diagrams.payload.json'), 'utf8'),
)
const cardOf = (page: Page, kind: string): Locator =>
  page
    .locator('figure')
    .filter({ has: page.locator(':scope > div:first-child > [data-kind-tag]', { hasText: new RegExp(`^${kind}$`) }) })
    .first()

/** A token's computed color, resolved the way the browser resolves it for text. */
const tokenColor = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('i')
    probe.style.color = `var(${name})`
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }, token)

// Console fix loop 1, lane F10a: the diagram-card items measured at the layer
// the reader sees. Each payload is small and its own; the boards' numbers are
// named on each test.

const section = (blocks: unknown[]) => ({
  meta: { title: 'F10a' },
  sections: [{ id: 's', no: 1, title: 'Probe', blocks }],
  decisions: [],
})

test.describe('F10a diagram cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('d010: a state label stays inside its 160 px node, however long it is', async ({ page }) => {
    await serveSession(
      page,
      section([
        {
          type: 'state',
          title: 'long labels',
          initial: 'a',
          states: [
            { id: 'a', label: 'Waiting for the upstream gateway to acknowledge the request' },
            { id: 'b', label: 'ReallyLongUnbreakableStateIdentifierNameWithoutAnySpaces' },
            { id: 'c', label: 'done' },
          ],
          transitions: [
            { from: 'a', to: 'b', label: 'ack' },
            { from: 'b', to: 'c', label: 'ok' },
          ],
        },
      ]),
    )
    await openReader(page, null)
    const nodes = page.locator('[data-state-node]')
    await expect(nodes).toHaveCount(3)
    const overflow = await nodes.evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect()
        const lines = [...el.querySelectorAll('span.block')].map((s) => {
          const range = document.createRange()
          range.selectNodeContents(s)
          const r = range.getBoundingClientRect()
          return Math.max(0, box.left - r.left, r.right - box.right)
        })
        return { id: el.getAttribute('data-state-node'), width: box.width, out: Math.max(0, ...lines) }
      }),
    )
    for (const n of overflow) expect(n.out, `node ${n.id}: text sticks out of the box by ${n.out}px`).toBeLessThanOrEqual(0.5)
  })

  test('d042: a top-level formula card holds the 49 px formula box (B-Blocks:169)', async ({ page }) => {
    await serveSession(page, section([{ type: 'math', latex: 'tokens(t) = \\min(C,\\ tokens_0 + r \\cdot \\Delta t)' }]))
    await openReader(page, null)
    const math = page.locator('[data-math]')
    await expect(math.locator('.katex')).toBeVisible()
    const box = (await math.boundingBox())!
    expect(box.height).toBeLessThanOrEqual(60)
  })

  test('d076: a formula in a details block is the bare box, not a nested card (B-Blocks:164-170)', async ({ page }) => {
    await serveSession(
      page,
      section([
        {
          type: 'details',
          summary: 'how to compute',
          blocks: [
            { type: 'p', text: 'refill r per second' },
            { type: 'math', latex: 'tokens(t) = \\min(C,\\ tokens_0 + r \\cdot \\Delta t)' },
          ],
        },
      ]),
    )
    await openReader(page, null)
    const figure = page.locator('figure').filter({ has: page.locator('summary') })
    await figure.locator('summary').click()
    await expect(figure.locator('[data-math] .katex')).toBeVisible()
    await expect(figure.locator('figure')).toHaveCount(0)
    await expect(figure.locator('[data-kind-tag], [data-kind-also]')).toHaveText(['details', 'math'])
    await expect(figure.locator('[data-kind-tag]')).toHaveCount(1)
    const boxEl = figure.locator('[data-math]').locator('..')
    await expect(boxEl).toHaveCSS('border-top-width', '1px')
    await expect(boxEl).toHaveCSS('border-top-left-radius', '4px')
    const box = (await boxEl.boundingBox())!
    expect(box.height).toBeLessThanOrEqual(60)
  })

  test('d004 seq: edges take the three phases, replies dash, node labels are sans (B-Blocks:83-88, B-Reader:130-135)', async ({ page }) => {
    await serveSession(page, diagrams)
    await openReader(page, null)
    const figure = cardOf(page, 'seq')
    const strokes = () =>
      figure.locator('[data-edge]').evaluateAll((edges) =>
        edges.map((e) => {
          const path = e.querySelector('path')!
          return [e.getAttribute('data-state'), getComputedStyle(e).stroke, path.getAttribute('stroke-dasharray')]
        }),
      )
    const [sub, faint, line2, accent] = await Promise.all(
      ['--c-sub', '--c-faint', '--c-line2', '--c-accent-line'].map((t) => tokenColor(page, t)),
    )
    const rest = await strokes()
    // Requests are sub and solid, replies faint and dashed 6 5.
    expect(rest.map(([state]) => state)).toEqual(Array(rest.length).fill('rest'))
    for (const [, stroke, dash] of rest) {
      if (dash === null) expect(stroke).toBe(sub)
      else expect([stroke, dash]).toEqual([faint, '6 5'])
    }
    expect(rest.some(([, , d]) => d !== null)).toBe(true)

    const steps = figure.getByRole('group', { name: 'Sequence steps' })
    for (let i = 0; i < 3; i++) await steps.press('ArrowRight')
    // The edges fade between phases (--dur-base); read them once they settle.
    await page.waitForTimeout(600)
    const stepped = (await strokes()).map(([state, stroke]) => [state, stroke])
    expect(stepped.slice(0, 2)).toEqual([['past', faint], ['past', faint]])
    expect(stepped[2]).toEqual(['current', accent])
    for (const row of stepped.slice(3)) expect(row).toEqual(['future', line2])

    const actorFonts = await figure.locator('[data-actor]').evaluateAll((els) => els.map((e) => getComputedStyle(e).fontFamily))
    for (const family of actorFonts) {
      expect(family).toMatch(/Geist/)
      expect(family).not.toMatch(/Mono/)
    }
  })

  test('d004 state/mermaid: node labels are sans, mermaid labels are 13px', async ({ page }) => {
    await serveSession(page, diagrams)
    await openReader(page, null)
    const nodeFont = await cardOf(page, 'state').locator('[data-state-node]').first().evaluate((e) => getComputedStyle(e).fontFamily)
    expect(nodeFont).toMatch(/Geist/)
    expect(nodeFont).not.toMatch(/Mono/)
    const mermaid = cardOf(page, 'mermaid')
    await expect(mermaid.locator('svg[id^="mm-"] g.node text').first()).toBeVisible()
    const sizes = await mermaid.locator('svg[id^="mm-"] g.node text, svg[id^="mm-"] g.node tspan').evaluateAll((els) => [...new Set(els.map((e) => getComputedStyle(e).fontSize))])
    expect(sizes).toEqual(['13px'])
  })

  test('d112: prose code takes the 13 px code size of the type scale (tokens.css type scale; B-Components:112 is the palette kind tag)', async ({ page }) => {
    await serveSession(page, section([{ type: 'p', text: 'call `env.LIMITER.limit` first' }]))
    await openReader(page, null)
    const chip = page.locator('[data-md] code')
    await expect(chip).toContainText('env.LIMITER.limit')
    await expect(chip).toHaveCSS('font-size', '13px')
  })
})
