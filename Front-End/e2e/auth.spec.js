import { test, expect } from '@playwright/test'
import { pool, uniqueEmail, createUser, PASSWORD } from './support.js'

const visible = (page, label) => page.locator(`input[aria-label="${label}"]:visible`).first()

test.describe('authentication journey', () => {
  test('register through the UI, verify by emailed link, sign in, reach the dashboard', async ({ page }) => {
    const email = uniqueEmail('journey')

    await page.goto('/signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Full names').fill('Grace')
    await page.getByLabel('Surname').fill('Hopper')
    await page.getByLabel('Country').fill('USA')
    await page.getByLabel('Phone number').fill('+27123456789')
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirm password').fill(PASSWORD)
    await page.getByRole('button', { name: /register/i }).click()

    await expect(page.getByRole('status')).toContainText(/user created/i)

    const { rows } = await pool.query('SELECT verification_token, is_verified FROM users WHERE email = $1', [email])
    expect(rows[0].is_verified).toBe(false)

    await page.goto(`/verify-email?token=${rows[0].verification_token}`)
    await expect(page.getByRole('status')).toContainText(/verified successfully/i)
    expect((await pool.query('SELECT is_verified FROM users WHERE email = $1', [email])).rows[0].is_verified).toBe(true)

    await page.goto('/signin')
    await visible(page, 'Email').fill(email)
    await visible(page, 'Password').fill(PASSWORD)
    await page.locator('button[type=submit]:visible').first().click()

    await expect(page).toHaveURL(/\/dashboard/)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy()
  })

  test('wrong password shows an announced error and stores no session', async ({ page }) => {
    const user = await createUser()

    await page.goto('/signin')
    await visible(page, 'Email').fill(user.email)
    await visible(page, 'Password').fill('definitely-wrong')
    await page.locator('button[type=submit]:visible').first().click()

    await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
    await expect(page).toHaveURL(/\/signin/)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
  })

  test('protected pages redirect a logged-out visitor to sign-in', async ({ page }) => {
    for (const path of ['/wallet', '/dashboard', '/orderstrades', '/transactions', '/withdraw/crypto', '/profile-setting']) {
      await page.goto(path)
      await expect(page, path).toHaveURL(/\/signin/)
    }
    await expect(page).toHaveTitle('Sign In | Anchor Exchange')
  })

  test('the session survives a reload and a client-side navigation', async ({ page }) => {
    const user = await createUser()
    await page.goto('/signin')
    await visible(page, 'Email').fill(user.email)
    await visible(page, 'Password').fill(user.password)
    await page.locator('button[type=submit]:visible').first().click()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.reload()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.goto('/wallet')
    await expect(page).toHaveURL(/\/wallet/)
  })

  test('a suspended account cannot sign in', async ({ page }) => {
    const user = await createUser()
    await pool.query('UPDATE users SET is_suspended = true WHERE id = $1', [user.id])

    await page.goto('/signin')
    await visible(page, 'Email').fill(user.email)
    await visible(page, 'Password').fill(user.password)
    await page.locator('button[type=submit]:visible').first().click()

    await expect(page.getByRole('alert')).toContainText(/suspended/i)
    await expect(page).toHaveURL(/\/signin/)
  })
})
