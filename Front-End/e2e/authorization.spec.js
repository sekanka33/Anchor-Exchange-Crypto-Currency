import { test, expect } from '@playwright/test'
import { pool, createUser, loginViaStorage } from './support.js'

test.describe('admin area', () => {
  test('a regular user who opens /admin is sent to their dashboard, never the admin panel', async ({ page }) => {
    const user = await createUser()
    await loginViaStorage(page, user)

    await page.goto('/admin')

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toHaveCount(0)
  })

  test('an admin gets the panel and can list users', async ({ page }) => {
    const admin = await createUser({ role: 'admin' })
    await loginViaStorage(page, { ...admin, role: 'admin' })

    await page.goto('/admin')

    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible()
    await page.getByRole('button', { name: 'Users' }).click()
    await expect(page.getByRole('button', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('cell', { name: admin.email, exact: true })).toBeVisible()
  })

  test('revoking admin server-side takes effect on the very next page load, despite a role in localStorage', async ({ page }) => {
    const admin = await createUser({ role: 'admin' })
    await loginViaStorage(page, { ...admin, role: 'admin' })
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible()

    await pool.query("UPDATE users SET role = 'user' WHERE id = $1", [admin.id])
    await page.reload()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toHaveCount(0)
  })
})
