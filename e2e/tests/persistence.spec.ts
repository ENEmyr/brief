import type { Page, Route } from '@playwright/test'
import { test, expect, testPayload, API_URL, selectFirstParagraphText, FIRST_PARAGRAPH_SELECTOR } from './fixtures'

const [d1] = testPayload.decisions
if (!d1) throw new Error('fixture payload changed shape')

/** The state endpoint answers "no copy" and rejects every PUT, as when the
 * reader is offline: localStorage is then the only place a change survives. */
async function serverHasNoCopy(page: Page, id: string) {
  await page.route(`${API_URL}/api/session/${id}/state`, (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: { state: null } }) : route.abort(),
  )
}

test.describe('persistence', () => {
  test('a reload right after a highlight keeps it while the server has no copy', async ({ page, createSession }) => {
    const { id } = await createSession()
    await serverHasNoCopy(page, id)
    await page.goto(`/s/${id}`)
    const selected = await selectFirstParagraphText(page)
    await page.getByRole('button', { name: 'Highlight' }).click()
    await page.reload()
    await expect(page.locator(FIRST_PARAGRAPH_SELECTOR).locator('mark')).toHaveText(selected)
  })

  test('a reload before the deferred local write fires keeps the highlight', async ({ page, createSession }) => {
    // The local write waits for a setTimeout(0), which usually fires before a
    // reload commits; stretching that wait makes the reload land inside it every run.
    await page.addInitScript(() => {
      const original = window.setTimeout
      window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) =>
        original(fn, ms === 0 || ms === undefined ? 2000 : ms, ...args)) as typeof window.setTimeout
    })
    const { id } = await createSession()
    await serverHasNoCopy(page, id)
    await page.goto(`/s/${id}`)
    const selected = await selectFirstParagraphText(page)
    await page.getByRole('button', { name: 'Highlight' }).click()
    await page.reload()
    await expect(page.locator(FIRST_PARAGRAPH_SELECTOR).locator('mark')).toHaveText(selected)
  })

  test('a 70,000-character reason typed just before a reload reaches the server, and the chip waits for the PUT', async ({
    page,
    request,
    createSession,
    isMobile,
  }) => {
    test.skip(isMobile, 'under 880 the chip hides saving and saved, and the sync path does not depend on the viewport')
    await page.addInitScript(() => {
      const log: string[] = []
      ;(window as unknown as { chipLog: string[] }).chipLog = log
      new MutationObserver(() => {
        for (const el of document.querySelectorAll('[role="status"]')) {
          const text = el.textContent ?? ''
          if (log[log.length - 1] !== text) log.push(text)
        }
      }).observe(document, { subtree: true, childList: true, characterData: true })
    })
    const { id } = await createSession()
    const stateUrl = `${API_URL}/api/session/${id}/state`
    const firstGet = page.waitForResponse((res) => res.url() === stateUrl && res.request().method() === 'GET')
    await page.goto(`/s/${id}`)
    await firstGet

    let reloaded = false
    const held: Route[] = []
    await page.route(stateUrl, async (route) => {
      if (route.request().method() === 'GET') {
        reloaded = true
        return route.continue()
      }
      // The unload-time PUT of a body past 64 KiB cannot use keepalive, and the
      // browser cancels it with the page: drop it here so the run never depends on luck.
      if (!reloaded) return route.abort()
      held.push(route)
    })

    const reason = 'r'.repeat(70_000)
    const dock = page.getByRole('complementary', { name: 'Decision dock' })
    await dock.getByRole('textbox', { name: `${d1.id} Reason` }).fill(reason)
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key)?.length ?? 0, `idocs:${id}`))
      .toBeGreaterThan(reason.length)
    await page.reload()

    await expect.poll(() => held.length, { message: 'the reloaded page sends the local state' }).toBeGreaterThan(0)
    const chipLog = await page.evaluate(() => (window as unknown as { chipLog: string[] }).chipLog)
    expect(chipLog.filter((text) => text.includes('saved'))).toEqual([])
    await expect(page.getByRole('status').filter({ hasText: 'saving' })).toBeVisible()

    for (const route of held) await route.continue()
    await expect
      .poll(async () => {
        const res = await request.get(stateUrl)
        const { state } = (await res.json()) as { state: string | null }
        return state === null ? 0 : ((JSON.parse(state) as { dnote: Record<string, string> }).dnote[d1.id]?.length ?? 0)
      })
      .toBe(reason.length)
    await expect(page.getByRole('status').filter({ hasText: 'saved' })).toBeVisible()
  })

  test('a device holding an older synced state takes the newer server copy at reload and never sends its own', async ({
    page,
    browser,
    baseURL,
    request,
    createSession,
    isMobile,
  }) => {
    test.skip(isMobile, 'the two-device sync path does not depend on the viewport')
    const { id } = await createSession()
    const stateUrl = `${API_URL}/api/session/${id}/state`
    const isPut = (res: { url(): string; request(): { method(): string } }) =>
      res.url() === stateUrl && res.request().method() === 'PUT'
    const reasonBox = (p: Page) =>
      p.getByRole('complementary', { name: 'Decision dock' }).getByRole('textbox', { name: `${d1.id} Reason` })
    const serverReason = async () => {
      const { state } = (await (await request.get(stateUrl)).json()) as { state: string | null }
      return state === null ? null : (JSON.parse(state) as { dnote: Record<string, string> }).dnote[d1.id]
    }

    await page.goto(`/s/${id}`)
    const oldSaved = page.waitForResponse(isPut)
    await reasonBox(page).fill('OLD')
    await oldSaved
    expect(await serverReason()).toBe('OLD')

    const otherContext = await browser.newContext({ baseURL })
    const other = await otherContext.newPage()
    await other.goto(`/s/${id}`)
    await expect(reasonBox(other)).toHaveValue('OLD')
    const newerSaved = other.waitForResponse(isPut)
    await reasonBox(other).fill('NEWER')
    await newerSaved
    expect(await serverReason()).toBe('NEWER')

    const putsAfterReload: string[] = []
    page.on('request', (req) => {
      if (req.url() === stateUrl && req.method() === 'PUT') putsAfterReload.push(req.postData() ?? '')
    })
    const reloadGet = page.waitForResponse((res) => res.url() === stateUrl && res.request().method() === 'GET')
    await page.reload()
    await reloadGet
    await expect(reasonBox(page)).toHaveValue('NEWER')
    await expect(page.getByRole('status').filter({ hasText: 'saved' })).toBeVisible()
    expect(putsAfterReload.filter((body) => body.includes('OLD'))).toEqual([])
    expect(await serverReason()).toBe('NEWER')

    await other.reload()
    await expect(reasonBox(other)).toHaveValue('NEWER')
    expect(await serverReason()).toBe('NEWER')
    await otherContext.close()
  })
})
