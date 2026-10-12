import { test, expect } from '@playwright/test'
import { pool, api, createUser, fund, balance, loginViaStorage } from './support.js'

// Money flows through the real UI, backend and database, with the demo
// payment provider and demo custodian (no real money moves).

test.describe('customer money flows (demo providers)', () => {
  test('ZAR bank-transfer deposit: reference, demo notice, provider confirmation, wallet credit', async ({ page }) => {
    const user = await createUser()
    await loginViaStorage(page, user)
    await page.goto('/deposit')

    await expect(page.getByText('Demo mode.').first()).toBeVisible()
    await page.getByRole('button', { name: /ZAR/ }).click()
    await page.getByLabel('Amount').fill('500')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: /Bank Transfer/ }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Create deposit' }).click()

    const reference = page.locator('code').first()
    await expect(reference).toHaveText(/^DEP-[0-9A-F]{16}$/)
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible()
    await expect(page.getByText(/no real bank account/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Deposit completed' })).toBeVisible({ timeout: 15_000 })
    expect(await balance(user.id, 'ZAR')).toEqual({ available: 500, locked: 0 })

    await page.goto('/wallet')
    await expect(page.getByText(/R\s500\.00/).first()).toBeVisible()
  })

  test('ZAR bank withdrawal to a new account: masked details, email confirmation, provider payout', async ({ page }) => {
    const user = await createUser()
    await fund(user.id, 'ZAR', 2000)
    await loginViaStorage(page, user)
    await page.goto('/withdraw')

    await page.getByRole('button', { name: /ZAR/ }).click()
    await page.getByLabel('Amount').fill('1000')
    await page.getByLabel('Account holder name').fill('Thandi Nkosi')
    await page.getByLabel('Bank', { exact: true }).fill('Capitec')
    await page.getByLabel('Account number').fill('1234567890')
    await page.getByLabel(/Branch code/).fill('470010')
    await page.getByLabel('Account type').selectOption('savings')
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByText('Capitec •••• 7890')).toBeVisible()
    await page.getByRole('button', { name: 'Request Withdrawal' }).click()
    await expect(page.getByText('Awaiting email confirmation')).toBeVisible()
    expect(await balance(user.id, 'ZAR')).toEqual({ available: 1000, locked: 1000 })
    await expect(page.getByText('1234567890')).toHaveCount(0)

    const { rows } = await pool.query("SELECT confirmation_token FROM withdrawals WHERE user_id = $1 AND status = 'PENDING_CONFIRMATION'", [user.id])
    const confirm = await page.context().newPage()
    await confirm.goto(`/withdrawals/confirm?token=${rows[0].confirmation_token}`)
    await expect(confirm.getByRole('status')).toContainText(/sent for processing/i)
    await confirm.close()

    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Payout reference')).toBeVisible()
    expect(await balance(user.id, 'ZAR')).toEqual({ available: 1000, locked: 0 })
  })

  test('demo crypto deposit is tracked to completion from custody events', async ({ page }) => {
    const user = await createUser()
    await loginViaStorage(page, user)
    await page.goto('/deposit/crypto')

    await expect(page.getByText(/Demo address — do not send real funds/)).toBeVisible()
    await expect(page.getByLabel('Network')).toHaveValue('BTC')
    await expect(page.getByAltText('Deposit address QR code')).toBeVisible()

    await page.getByLabel('Simulated deposit amount').fill('0.25')
    await page.getByRole('button', { name: 'Simulate Deposit' }).click()

    const recent = page.getByRole('region', { name: /Recent BTC deposits/ }).or(page.locator('section', { has: page.getByRole('heading', { name: /Recent BTC deposits/ }) }))
    await expect(recent.getByText('Completed')).toBeVisible({ timeout: 20_000 })
    await expect(recent.getByText(/Tx: demo-/)).toBeVisible()
    expect(await balance(user.id, 'BTC')).toEqual({ available: 0.25, locked: 0 })
  })

  test('transaction history shows pending and completed activity with fiat filters', async ({ page }) => {
    const user = await createUser()
    await fund(user.id, 'ZAR', 5000)
    const buy = await api('POST', '/api/orders/buy', { token: user.token, body: { asset: 'BTC', amount: '900', currency: 'ZAR', paymentMethod: 'wallet' } })
    expect(buy.status).toBe(201)
    await api('POST', '/api/withdrawals/fiat', {
      token: user.token,
      body: { amount: '300', currency: 'ZAR', bankDetails: { accountHolderName: 'T', bankName: 'FNB', accountNumber: '62000000001', branchCode: '250655' } },
    })
    await loginViaStorage(page, user)
    await page.goto('/transactions')

    await expect(page.getByRole('cell', { name: 'Awaiting email confirmation' })).toBeVisible()
    await expect(page.getByRole('cell', { name: /^R\s9\.00$/ })).toBeVisible() // the buy's 1% fee, in rand — not "9 BTC"

    await page.getByLabel('Currency kind').selectOption('fiat')
    await expect(page.getByRole('cell', { name: 'BUY' })).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'WITHDRAWAL' })).toBeVisible()
  })
})

test.describe('administrator finance tools', () => {
  test('review a withdrawal, reject it with a reason, and see it in the audit log and reconciliation', async ({ page }) => {
    const admin = await createUser({ role: 'admin' })
    const user = await createUser()
    await fund(user.id, 'ZAR', 3000)
    const req = await api('POST', '/api/withdrawals/fiat', {
      token: user.token,
      body: { amount: '1500', currency: 'ZAR', bankDetails: { accountHolderName: 'Lerato M', bankName: 'Nedbank', accountNumber: '1198765432', branchCode: '198765' } },
    })
    const ref = `WD-${req.body.withdrawal.id}`

    await loginViaStorage(page, { ...admin, role: 'admin' })
    await page.goto('/admin?tab=withdrawals')
    await page.getByPlaceholder(/WD-reference/).fill(ref)
    await expect(page.getByRole('cell', { name: ref })).toBeVisible()
    await page.getByRole('button', { name: 'Review' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Nedbank •••• 5432', { exact: false })).toBeVisible()
    await expect(dialog.getByText('No — new destination')).toBeVisible()
    await expect(dialog.getByText('1198765432')).toHaveCount(0)
    const reject = dialog.getByRole('button', { name: 'Reject and release funds' })
    await expect(reject).toBeDisabled()
    await dialog.getByLabel(/Reject before it's confirmed/).fill('Beneficiary name does not match the account holder')
    await reject.click()
    await expect(dialog.getByRole('status')).toContainText(/rejected and funds released/i)
    expect(await balance(user.id, 'ZAR')).toEqual({ available: 3000, locked: 0 })
    await dialog.getByRole('button', { name: 'Close dialog' }).click()

    await page.goto('/admin?tab=audit%20log')
    await expect(page.getByRole('cell', { name: 'WITHDRAWAL_REJECT' }).first()).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Beneficiary name does not match the account holder' })).toBeVisible()

    await page.goto('/admin?tab=reconciliation')
    await expect(page.getByText(/Ledger vs wallet mismatches: 0 · Unbalanced journals: 0/)).toBeVisible()
  })
})
