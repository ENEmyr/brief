import type { Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const diffPayload: Payload = {
  meta: { title: 'Diff block' },
  sections: [
    {
      id: 'limiter',
      no: 1,
      title: 'Rate limiter',
      blocks: [
        {
          type: 'diff',
          files: [
            {
              path: 'src/limiter.ts',
              status: 'modified',
              patch:
                '@@ -1,4 +1,6 @@\n export async function handle(req, env) {\n   const key = resolveKey(req)\n+  const { success } = await env.LIMITER.limit({ key })\n+  if (!success) return tooMany(30)\n-  return fetch(req.url)\n+  return fetch(origin(req))',
              changes: [
                {
                  symbol: 'handle()',
                  change: 'modified',
                  summary: 'Checks the rate limiter before forwarding.',
                },
                {
                  symbol: 'resolveKey()',
                  change: 'added',
                  summary: 'API key first, client IP only as a fallback.',
                  steps: [
                    'read x-api-key',
                    'fall back to CF-Connecting-IP',
                    'lowercase and prefix with the plan',
                  ],
                },
              ],
            },
            {
              path: 'wrangler.toml',
              status: 'modified',
              patch: '@@ -3 +3,4 @@\n+[[limits]]\n+name = "LIMITER"',
              changes: [
                { symbol: '[limits]', change: 'config', summary: 'Binding LIMITER, 600 per 60 s.' },
              ],
            },
            {
              path: 'test/limiter.test.ts',
              status: 'added',
              folded: true,
              patch: '+it("limits", () => {})',
            },
          ],
          map: {
            nodes: [
              { id: 'client', label: 'Client' },
              { id: 'edge', label: 'Edge Worker', status: 'modified' },
              { id: 'limiter', label: 'Limiter', status: 'added' },
              { id: 'origin', label: 'Origin API' },
            ],
            edges: [
              { from: 'client', to: 'edge' },
              { from: 'edge', to: 'limiter' },
              { from: 'edge', to: 'origin' },
            ],
          },
        },
      ],
    },
  ],
  decisions: [],
}

test.describe('diff block', () => {
  test('mode toggle and changed-files filter work by mouse and keyboard', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession(diffPayload)
    await page.goto(`/s/${id}`)
    const card = page
      .locator('figure')
      .filter({ has: page.getByRole('group', { name: 'Diff mode' }) })
    const semantic = card.getByRole('button', { name: 'semantic' })
    const raw = card.getByRole('button', { name: 'raw' })
    const files = card.getByRole('navigation', { name: 'Changed files' })
    const note = card.getByText('Checks the rate limiter before forwarding.')

    await expect(card.locator('[data-diff-node]')).toHaveCount(4)
    await expect(semantic).toHaveAttribute('aria-pressed', 'true')
    await expect(note).toBeVisible()

    await raw.click()
    await expect(raw).toHaveAttribute('aria-pressed', 'true')
    await expect(card.locator('[data-line="del"]')).toHaveText('-  return fetch(req.url)')
    await semantic.focus()
    await page.keyboard.press('Enter')
    await expect(semantic).toHaveAttribute('aria-pressed', 'true')
    await expect(note).toBeVisible()
    await raw.focus()
    await page.keyboard.press('Space')
    await expect(raw).toHaveAttribute('aria-pressed', 'true')
    await semantic.click()

    const wrangler = files.getByRole('button', { name: /wrangler\.toml/ })
    await wrangler.click()
    await expect(wrangler).toHaveAttribute('aria-pressed', 'true')
    await expect(note).toHaveCount(0)
    await expect(card.getByText('Binding LIMITER, 600 per 60 s.')).toBeVisible()
    await wrangler.focus()
    await page.keyboard.press('Enter')
    await expect(wrangler).toHaveAttribute('aria-pressed', 'false')
    await expect(note).toBeVisible()

    const folded = files.getByRole('button', { name: /test\/limiter\.test\.ts/ })
    await folded.focus()
    await page.keyboard.press('Space')
    await expect(folded).toHaveAttribute('aria-pressed', 'true')
    await expect(card.getByRole('button', { name: 'Fold', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})
