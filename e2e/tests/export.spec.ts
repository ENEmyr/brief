import { test, expect, testPayload, selectFirstParagraphText, FIRST_PARAGRAPH_SELECTOR } from './fixtures'

test.describe('export', () => {
  test('Markdown button downloads a file with the doc title and highlights section', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)

    // Annotate first so the export has real reader state to carry: the
    // downloaded markdown must list the highlighted text under "Reader
    // highlights & notes", not just render the boilerplate heading over an
    // empty "(no highlights)" body.
    const selected = await selectFirstParagraphText(page)
    expect(selected.length).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Highlight' }).click()
    await expect(page.locator(FIRST_PARAGRAPH_SELECTOR).locator('mark')).toBeVisible()

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
    // The highlight made above must appear AFTER the heading with the exact
    // selected text (download.ts renders each entry as
    // `N. Highlighted: “<text>”` with curly quotes) -- and the empty-state
    // placeholder must be gone.
    const highlightsSection = content.split('Reader highlights & notes')[1] ?? ''
    expect(highlightsSection).toContain(`Highlighted: “${selected}”`)
    expect(highlightsSection).not.toContain('(no highlights)')
  })
})
