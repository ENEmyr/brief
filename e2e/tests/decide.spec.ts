import { test, expect, testPayload } from './fixtures'

test.describe('decide', () => {
  test('answering both decisions unlocks a reply prompt containing "Reply to"', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)

    const [d1, d2] = testPayload.decisions
    if (!d1 || !d2) throw new Error('fixture payload changed shape')

    // DecisionSection is a single-question stepper: only the current
    // DecisionCard is in the DOM at a time (DecisionSection.tsx), so d1 is
    // answered first, then the jump pill navigates to d2 before its option
    // buttons exist.
    await expect(page.getByText(d1.q)).toBeVisible()
    await page.getByRole('button', { name: d1.opts[0]!.label }).click()

    await page.getByRole('button', { name: `Question ${d2.id}` }).click()
    await expect(page.getByText(d2.q)).toBeVisible()
    await page.getByRole('button', { name: d2.opts[0]!.label }).click()

    const generateButton = page.getByRole('button', { name: /Generate prompt/ })
    await expect(generateButton).toBeVisible()
    await generateButton.click()

    const promptTextarea = page.getByRole('textbox', { name: 'Prompt text' })
    await expect(promptTextarea).toBeVisible()
    await expect(promptTextarea).toHaveValue(/Reply to/)
  })
})
