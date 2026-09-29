import { test, expect } from '@playwright/test'
import { pool, api, createUser, fund, balance, loginViaStorage } from './support.js'

const BTC_ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'

test.describe('money flows across the real stack', () => {
  test('wallet page prices holdings live through the backend proxy', async ({ page }) => {
    const user = await createUser()
    await fund(user.id, 'BTC', 0.1) // stubbed BTC price is $50,000
    await loginViaStorage(page, user)

    await page.goto('/wallet')

    await expect(page.getByText('$5,000.00').first()).toBeVisible()
    await expect(page.getByText('Total Portfolio Value')).toBeVisible()
  })

  test('a brand-new user sees an honest empty wallet, not fake numbers', async ({ page }) => {
    const user = await createUser()
    await loginViaStorage(page, user)

    await page.goto('/wallet')

    await expect(page.getByText('Total Portfolio Value')).toBeVisible()
    await expect(page.getByText('$0.00').first()).toBeVisible()
  })

  test('emailed withdrawal link: confirming completes it once, replaying the link fails', async ({ page }) => {
    const user = await createUser()
    await fund(user.id, 'BTC', 0.05)

    const req = await api('POST', '/api/withdrawals/crypto', {
      token: user.token,
      body: { asset: 'BTC', network: 'BTC', amount: 0.01, address: BTC_ADDRESS },
    })
    expect(req.status).toBe(201)
    expect(await balance(user.id, 'BTC')).toEqual({ available: 0.04, locked: 0.01 })

    const { rows } = await pool.query('SELECT confirmation_token FROM withdrawals WHERE id = $1', [req.body.withdrawal.id])
    const link = `/withdrawals/confirm?token=${rows[0].confirmation_token}`

    await page.goto(link)
    await expect(page.getByRole('status')).toContainText(/confirmed and processed/i)
    expect(await balance(user.id, 'BTC')).toEqual({ available: 0.04, locked: 0 })

    await page.goto(link)
    await expect(page.getByRole('status')).toContainText(/invalid, expired, or already used/i)
    expect(await balance(user.id, 'BTC')).toEqual({ available: 0.04, locked: 0 })
  })

  test('a withdrawal confirmation link with no token shows a clear error', async ({ page }) => {
    await page.goto('/withdrawals/confirm')
    await expect(page.getByRole('status')).toContainText(/missing a token/i)
  })

  test('transaction history lists a completed purchase and opens an accessible detail dialog', async ({ page }) => {
    const user = await createUser()
    const buy = await api('POST', '/api/orders/buy', { token: user.token, body: { asset: 'BTC', amountUsd: 100, paymentMethod: 'card' } })
    expect(buy.status).toBe(201)
    await loginViaStorage(page, user)

    await page.goto('/transactions')
    const row = page.locator('tbody tr').first()
    await expect(row).toContainText('BUY')
    await row.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(`Transaction #${buy.body.transaction.id}`)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('orders page shows only the signed-in user’s orders', async ({ page }) => {
    const alice = await createUser()
    const bob = await createUser()
    await api('POST', '/api/orders/buy', { token: alice.token, body: { asset: 'BTC', amountUsd: 100, paymentMethod: 'card' } })
    await loginViaStorage(page, bob)

    await page.goto('/orderstrades')

    await expect(page.getByText('No orders match these filters.')).toBeVisible()
  })
})
