import type { Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const opts = [
  { id: 'a', label: 'Alpha choice' },
  { id: 'b', label: 'Beta choice' },
]

const payload: Payload = {
  meta: { title: 'Fields round 1' },
  sections: [
    { id: 'intro', no: 1, title: 'Introduction', blocks: [{ type: 'p', text: 'Opening paragraph.' }] },
    {
      id: 'map',
      no: 2,
      title: 'Change map',
      blocks: [
        {
          type: 'layers',
          title: 'Request path',
          layers: [
            {
              id: 'edge',
              label: 'Edge',
              nodes: [
                { id: 'worker', label: 'Edge Worker', diffNode: 'w' },
                { id: 'limiter', label: 'Limiter', diffNode: 'l' },
                { id: 'origin', label: 'Origin API', diffNode: 'o' },
              ],
              edges: [],
            },
          ],
        },
        {
          type: 'diff',
          files: [{ path: 'src/limiter.ts', status: 'modified' }],
          map: {
            nodes: [
              { id: 'w', label: 'Edge Worker', status: 'modified' },
              { id: 'l', label: 'Limiter', status: 'added' },
              { id: 'o', label: 'Origin API' },
            ],
            edges: [],
          },
        },
        {
          type: 'histogram',
          title: 'Latency',
          bins: ['0.1', '0.3', '0.5', '0.8'].map((label, i) => ({ label, count: 8 - i })),
          threshold: { bin: 3, label: 'p95', value: '2.4 s' },
        },
      ],
    },
  ],
  decisions: [{ id: 'D1', q: 'Which limiter?', multi: false, opts, refs: ['map'] }],
}

test('a layers node shows its diff badge, and the full-screen histogram keeps its threshold line', async ({
  page,
  createSession,
}) => {
  const { id } = await createSession(payload)
  await page.goto(`/s/${id}`)

  const node = (name: string) => page.locator(`[data-layer-node="${name}"]`)
  await expect(node('worker').locator('[data-diff-badge]')).toHaveText('M')
  await expect(node('limiter').locator('[data-diff-badge]')).toHaveText('new')
  await expect(node('origin').locator('[data-diff-badge]')).toHaveCount(0)

  const histogram = page.locator('figure', { has: page.locator('[data-kind-tag]:text-is("histogram")') })
  await expect(histogram.locator('[data-threshold-line]')).toBeVisible()
  await histogram.getByRole('button', { name: 'Open diagram full screen' }).click()
  const viewer = page.getByRole('dialog', { name: 'Diagram viewer' })
  await expect(viewer.locator('[data-threshold-line]')).toBeVisible()
  await expect(viewer.getByText('p95 2.4 s')).toBeVisible()
})

test('the outline marks a section an open decision points to, until it is answered', async ({
  page,
  createSession,
  isMobile,
}) => {
  test.skip(isMobile, 'the outline is a drawer under 880')
  const { id } = await createSession(payload)
  await page.goto(`/s/${id}`)

  const dot = page.getByRole('img', { name: 'open decisions' })
  await expect(dot).toHaveCount(1)
  await expect(page.locator('a[href="#map"]').getByRole('img', { name: 'open decisions' })).toBeVisible()

  await page.getByRole('group', { name: 'Question D1' }).getByRole('radio', { name: 'Alpha choice' }).click()
  await expect(dot).toHaveCount(0)
})
