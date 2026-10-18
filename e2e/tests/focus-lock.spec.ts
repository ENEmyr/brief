import type { Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const filler = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    type: 'p' as const,
    text: `Paragraph ${i + 1} adds height so the page scrolls well past one screen.`,
  }))

const payload: Payload = {
  meta: { title: 'Focus and scroll lock' },
  sections: [
    { id: 'top', no: 1, title: 'Top', blocks: filler(4) },
    {
      id: 'flow',
      no: 2,
      title: 'Flow',
      blocks: [
        {
          type: 'seq',
          title: 'Request path',
          actors: ['Client', 'Edge'],
          steps: [
            { from: 'Client', to: 'Edge', label: 'GET /orders' },
            { from: 'Edge', to: 'Client', label: '200 OK' },
          ],
        },
      ],
    },
    { id: 'bottom', no: 3, title: 'Bottom', blocks: filler(8) },
  ],
  decisions: [],
}

const bodyOverflow = (page: Page) => page.evaluate(() => document.body.style.overflow)
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)

test.describe('the outline drawer and the diagram viewer use the shared dialog focus', () => {
  test('the outline drawer locks page scroll and hands focus back to Open outline', async ({
    page,
    createSession,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Focus and scroll lock' })).toBeVisible()
    await page.evaluate(() => window.scrollTo({ top: 120, behavior: 'instant' }))
    await expect.poll(() => scrollY(page)).toBe(120)
    expect(await bodyOverflow(page)).toBe('')

    const trigger = page.getByRole('button', { name: 'Open outline' })
    await trigger.click()
    const drawer = page.getByRole('dialog', { name: 'Outline' })
    await expect(drawer).toBeVisible()
    await expect(drawer).toBeFocused()
    expect(await bodyOverflow(page)).toBe('hidden')

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    expect(await bodyOverflow(page)).toBe('')
    await expect(trigger).toBeFocused()
    expect(await scrollY(page)).toBe(120)

    await trigger.click()
    await expect(drawer).toBeVisible()
    await drawer.getByRole('link', { name: /Bottom/ }).click()
    await expect(drawer).toBeHidden()
    expect(await bodyOverflow(page)).toBe('')
    await expect.poll(() => scrollY(page), { message: 'the jump still scrolls after the lock is released' }).toBeGreaterThan(120)
  })

  test('the diagram viewer locks page scroll and hands focus back to its open button', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const open = page.getByRole('button', { name: 'Open diagram full screen' })
    await open.scrollIntoViewIfNeeded()
    await expect(open).toBeVisible()
    expect(await bodyOverflow(page)).toBe('')

    const viewer = page.getByRole('dialog', { name: 'Diagram viewer' })
    for (const close of ['Escape', 'Close viewer'] as const) {
      await open.click()
      const at = await scrollY(page)
      await expect(viewer).toBeVisible()
      await expect(viewer).toBeFocused()
      expect(await bodyOverflow(page)).toBe('hidden')

      if (close === 'Escape') await page.keyboard.press('Escape')
      else await viewer.getByRole('button', { name: 'Close viewer' }).click()
      await expect(viewer).toBeHidden()
      expect(await bodyOverflow(page)).toBe('')
      await expect(open).toBeFocused()
      expect(await scrollY(page)).toBe(at)
    }
  })
})
