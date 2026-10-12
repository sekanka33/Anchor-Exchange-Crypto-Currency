import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { createUser, loginViaStorage, PASSWORD } from './support.js'

// Same secret the E2E backend signs with (Back-End/tests/helpers/env.js), so
// these tests can mint expired / short-lived tokens for a real account.
const require = createRequire(new URL('../../Back-End/package.json', import.meta.url))
require('./tests/helpers/env.js')
const jwt = require('jsonwebtoken')
const tokenFor = (user, expiresIn) => jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn })

const CUSTOMER_PAGES = ['/', '/markets', '/exchange', '/spot', '/buy-crypto', '/wallet', '/orderstrades', '/assets', '/profile-setting', '/dashboard']

// The sign-in page renders a desktop and a mobile form; use the visible one.
const signInThroughForm = async (page, { email, password }) => {
  await page.getByLabel('Email').filter({ visible: true }).fill(email)
  await page.getByLabel('Password').filter({ visible: true }).fill(password)
  await page.getByRole('button', { name: /log\s?in/i }).filter({ visible: true }).click()
}

test.describe('one login page, routed by the role the server reports', () => {
  test('a normal user lands in the customer app and cannot open /admin', async ({ page }) => {
    const user = await createUser()
    await page.goto('/signin')
    await signInThroughForm(page, user)

    await expect(page).toHaveURL(/\/dashboard$/)

    await page.goto('/markets')
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Buy Crypto' }).first()).toBeVisible()

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toHaveCount(0)
  })

  test('an administrator lands on /admin, sees only the admin app, and is kept there', async ({ page }) => {
    const admin = await createUser({ role: 'admin' })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))

    // Asked for a customer page while signed out: the admin role still wins.
    await page.goto('/wallet')
    await expect(page).toHaveURL(/\/signin$/)
    await signInThroughForm(page, admin)

    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Buy Crypto' })).toHaveCount(0)

    for (const path of CUSTOMER_PAGES) {
      await page.goto(path)
      await expect(page, `${path} should bounce to /admin`).toHaveURL(/\/admin$/)
      await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible()
    }

    // Refreshing keeps a valid admin session on the dashboard.
    await page.reload()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the sign-in page itself sends an already signed-in admin back to /admin', async ({ page }) => {
    const admin = await createUser({ role: 'admin' })
    await loginViaStorage(page, { ...admin, role: 'admin' })
    for (const path of ['/signin', '/signup']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/admin$/)
    }
  })
})

test.describe('tampering and sessions', () => {
  test('setting role=admin in localStorage gives a normal user nothing', async ({ page }) => {
    const user = await createUser()
    await loginViaStorage(page, { ...user, role: 'admin' }) // writes role=admin to localStorage

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/dashboard$/)

    const res = await page.evaluate(async (token) => (await fetch('http://localhost:5100/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })).status, user.token)
    expect(res).toBe(403)
  })

  test('signing out of the admin app ends the session: /admin then asks for sign in', async ({ page }) => {
    const admin = await createUser({ role: 'admin' })
    await page.goto('/signin')
    await signInThroughForm(page, admin)
    await expect(page).toHaveURL(/\/admin$/)

    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/signin$/)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/signin$/)
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toHaveCount(0)
  })

  test('an expired token is not a session', async ({ page }) => {
    const admin = await createUser({ role: 'admin' })
    await loginViaStorage(page, { ...admin, token: tokenFor(admin, -10) })

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.getByText('Your session has ended. Please sign in again.').filter({ visible: true })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
  })

  test('a session that expires while the page is open signs the user out', async ({ page }) => {
    const user = await createUser()
    await loginViaStorage(page, { ...user, token: tokenFor(user, 4) })

    await page.goto('/wallet')
    await expect(page.getByRole('heading', { level: 1, name: 'Wallet' })).toBeVisible()

    await expect(page).toHaveURL(/\/signin$/, { timeout: 10_000 })
    await expect(page.getByText('Your session has ended. Please sign in again.').filter({ visible: true })).toBeVisible()
  })

  test('suspending a signed-in user ends their session on the next check', async ({ page }) => {
    const { pool } = await import('./support.js')
    const user = await createUser()
    await loginViaStorage(page, user)
    await page.goto('/wallet')
    await expect(page.getByRole('heading', { level: 1, name: 'Wallet' })).toBeVisible()

    await pool.query('UPDATE users SET is_suspended = true WHERE id = $1', [user.id])
    await page.reload()

    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.getByText(/suspended/i).filter({ visible: true }).first()).toBeVisible()
  })
})

test('registering never creates an administrator', async ({ page }) => {
  const user = await createUser() // real POST /api/auth/register through the API
  await page.goto('/signin')
  await signInThroughForm(page, { email: user.email, password: PASSWORD })
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/dashboard$/)
})
