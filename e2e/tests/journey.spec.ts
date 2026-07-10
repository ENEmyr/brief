import { test, expect, testPayload } from './fixtures'

test.describe('reader journey', () => {
  test('creates a session via the API and renders its title and blocks', async ({ page, createSession }) => {
    const { id } = await createSession()

    await page.goto(`/s/${id}`)

    await expect(page.getByRole('heading', { level: 1, name: testPayload.meta.title })).toBeVisible()

    const firstParagraph = testPayload.sections[0]!.blocks[0]!
    if (firstParagraph.type !== 'p') throw new Error('fixture payload changed shape')
    await expect(page.getByText(firstParagraph.text)).toBeVisible()

    const noteBlock = testPayload.sections[0]!.blocks[1]!
    if (noteBlock.type !== 'note') throw new Error('fixture payload changed shape')
    await expect(page.getByText(noteBlock.text)).toBeVisible()

    await expect(page.getByRole('table')).toBeVisible()
    // DataTable renders the first column as `<th scope="row">` (row header
    // semantics), so its accessible role is "rowheader", not "cell".
    await expect(page.getByRole('rowheader', { name: 'Reader' })).toBeVisible()

    const seqBlock = testPayload.sections[1]!.blocks[0]!
    if (seqBlock.type !== 'seq') throw new Error('fixture payload changed shape')
    await expect(page.getByText(seqBlock.title!)).toBeVisible()

    const codeBlock = testPayload.sections[1]!.blocks[1]!
    if (codeBlock.type !== 'code') throw new Error('fixture payload changed shape')
    // exact: true -- CodeBlock's header shows only "ts", but a non-exact
    // text match also matches any element whose text merely contains "ts"
    // as a substring (e.g. the seq diagram's "Client"/"Server" labels).
    await expect(page.getByText(codeBlock.language, { exact: true })).toBeVisible()
  })

  test('shows a not-found message for an unknown session id', async ({ page }) => {
    await page.goto('/s/00000000000000')
    await expect(page.getByText('Session not found or expired.')).toBeVisible()
  })
})
