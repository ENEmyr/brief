import { test, expect, testPayload } from './fixtures'

test.describe('export', () => {
  test('Markdown button downloads a file with the doc title and highlights section', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)

    // Arm the listener before the click -- the download event fires the
    // instant the anchor's click() resolves (downloadMarkdown in
    // export/lib/download.ts), which can race a waiter set up afterward.
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download markdown' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe(`brief-${id}.md`)

    const stream = await download.createReadStream()
    if (!stream) throw new Error('download produced no readable stream')
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const content = Buffer.concat(chunks).toString('utf-8')

    expect(content).toContain(testPayload.meta.title)
    expect(content).toContain('Reader highlights & notes')
  })
})
