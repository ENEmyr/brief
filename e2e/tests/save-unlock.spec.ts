import { test, expect, testPayload, API_URL } from './fixtures'

// Fixed, non-secret test credential used only against local wrangler dev
// servers for the duration of this spec's own session -- not a real secret.
const testPassphrase = 'test-pass-123'

test.describe('save + encrypt + unlock', () => {
  test('saving with a password encrypts server-side, and unlock gates on the password', async ({
    page,
    createSession,
  }) => {
    // Own session: encrypt-save is irreversible server-side (a second save
    // attempt on the same id 409s per saveFeature/service.ts), so this spec
    // must not share a session with any other spec.
    const { id } = await createSession()
    await page.goto(`/s/${id}`)

    await page.getByRole('button', { name: 'Save' }).click()
    const dialog = page.getByRole('dialog', { name: 'Save this doc' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Save with password' }).click()
    await dialog.getByLabel('Password', { exact: true }).fill(testPassphrase)
    await dialog.getByLabel('Confirm password').fill(testPassphrase)

    const savePut = page.waitForResponse(
      (res) => res.url().includes(`/api/session/${id}/save`) && res.request().method() === 'PUT',
    )
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    const putResponse = await savePut
    expect(putResponse.ok()).toBe(true)
    await expect(dialog).not.toBeVisible()

    // Server envelope is encrypted -- verified via the API, not just the UI.
    const envelope = await page.request.get(`${API_URL}/api/session/${id}`)
    expect(envelope.ok()).toBe(true)
    const envelopeBody = await envelope.json()
    expect(envelopeBody.encrypted).toBe(true)
    expect(envelopeBody.encParams).toBeTruthy()

    // Reload re-locks the session (decrypted state is memory-only), landing
    // back on the unlock form.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Protected session' })).toBeVisible()

    await page.getByLabel('Password').fill('wrong-password-entirely')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByText('Wrong password or corrupted data.')).toBeVisible()

    await page.getByLabel('Password').fill(testPassphrase)
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByRole('heading', { level: 1, name: testPayload.meta.title })).toBeVisible()
  })
})
