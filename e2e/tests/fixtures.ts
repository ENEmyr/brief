import { test as base, expect, type Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { API_URL } from '../playwright.config'

export { API_URL }

/** First section's first paragraph -- the only block the annotate flow targets. */
export const FIRST_PARAGRAPH_SELECTOR = '[data-hl][data-sid="0"][data-bid="0"]'

/** How many characters of the first paragraph the annotate flow selects. */
export const SELECTION_LENGTH = 20

/**
 * Selects the first SELECTION_LENGTH characters of the first paragraph and
 * fires the mouseup SelectionToolbar listens for on `document`
 * (SelectionToolbar.tsx) -- Playwright has no native "select this substring
 * of text" API, so the component's mouseup-driven contract is reproduced by
 * building a Range directly in the page. Returns the exact selected text so
 * callers can assert the resulting mark/export content against it.
 */
export async function selectFirstParagraphText(page: Page): Promise<string> {
  const paragraph = page.locator(FIRST_PARAGRAPH_SELECTOR)
  await expect(paragraph).toBeVisible()
  const selected = await page.evaluate(
    ({ selector, length }) => {
      const el = document.querySelector(selector)
      const textNode = el?.firstChild
      if (!textNode) throw new Error('paragraph text node not found')
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, length)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      return selection?.toString() ?? ''
    },
    { selector: FIRST_PARAGRAPH_SELECTOR, length: SELECTION_LENGTH },
  )
  await paragraph.dispatchEvent('mouseup')
  return selected
}

/**
 * One payload exercising p/note/table/seq/code block types plus a two
 * question decisions array, reused by every spec that needs a session.
 * Option labels are deliberately distinct across both decisions so
 * `getByRole('button', { name })` lookups never collide with each other or
 * with prose elsewhere on the page.
 */
export const testPayload: Payload = {
  meta: { title: 'E2E Journey Doc', author: 'QA Bot', version: 'v1' },
  sections: [
    {
      id: 'intro',
      no: 1,
      title: 'Introduction',
      blocks: [
        {
          type: 'p',
          text: 'This paragraph exists so the annotation toolbar has real prose to select and highlight during the e2e run.',
        },
        { type: 'note', title: 'Heads up', text: 'This is a note block rendered inside the intro section.' },
        {
          type: 'table',
          caption: 'Feature matrix',
          head: ['Feature', 'Status'],
          rows: [
            ['Reader', 'shipped'],
            ['Decisions', 'shipped'],
          ],
        },
      ],
    },
    {
      id: 'flow',
      no: 2,
      title: 'Flow',
      blocks: [
        {
          type: 'seq',
          title: 'Request flow',
          actors: ['Client', 'Server'],
          steps: [{ from: 'Client', to: 'Server', label: 'GET /api/session/:id' }],
        },
        { type: 'code', language: 'ts', code: "console.log('hello from e2e')" },
      ],
    },
  ],
  decisions: [
    {
      id: 'd1',
      q: 'Which color scheme should the doc use?',
      multi: false,
      opts: [
        { id: 'o1', label: 'Latte' },
        { id: 'o2', label: 'Mocha' },
      ],
    },
    {
      id: 'd2',
      q: 'Which extra features should ship?',
      multi: true,
      opts: [
        { id: 'o1', label: 'Fastexport' },
        { id: 'o2', label: 'Cheapstorage' },
      ],
    },
  ],
}

export interface CreatedSession {
  id: string
  url: string
}

type Fixtures = {
  createSession: (payload?: Payload) => Promise<CreatedSession>
}

/**
 * Extends Playwright's base `test` with an API-request-backed
 * `createSession` fixture -- every spec that needs a live session calls it
 * itself (rather than sharing one from a beforeAll) so the irreversible
 * save-encrypt spec never contaminates the others.
 */
export const test = base.extend<Fixtures>({
  createSession: async ({ request }, use) => {
    await use(async (payload: Payload = testPayload) => {
      const res = await request.post(`${API_URL}/api/session`, { data: { payload } })
      if (!res.ok()) {
        throw new Error(`createSession failed: ${res.status()} ${await res.text()}`)
      }
      const body = (await res.json()) as CreatedSession
      return body
    })
  },
})

export { expect }
