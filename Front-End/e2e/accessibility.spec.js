import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { createUser, loginViaStorage } from './support.js'

const require = createRequire(import.meta.url)
const AXE = require.resolve('axe-core/axe.min.js')

const PUBLIC = ['/', '/markets', '/signin', '/signup', '/forgot-password', '/contact']
const AUTHED = ['/wallet', '/orderstrades', '/transactions', '/deposit', '/withdraw', '/profile-setting', '/notifications']

const violationsOn = async (page) => {
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
    return r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 80)}`)
  })
}

// Guards the Stage 17 work: any page that regresses fails here, in both themes.
for (const theme of ['light', 'dark']) {
  test.describe(`axe (${theme} theme)`, () => {
    for (const path of PUBLIC) {
      test(`public ${path} has no violations`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        expect(await violationsOn(page)).toEqual([])
      })
    }

    test('signed-in pages have no violations', async ({ page }) => {
      const user = await createUser()
      await loginViaStorage(page, user, theme)
      const failures = {}
      for (const path of AUTHED) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const v = await violationsOn(page)
        if (v.length) failures[path] = v
      }
      expect(failures).toEqual({})
    })
  })
}

test('every page has one h1, a main landmark, and a route-specific title', async ({ page }) => {
  const user = await createUser()
  await loginViaStorage(page, user)
  for (const path of [...PUBLIC, ...AUTHED]) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const visibleH1 = await page.locator('h1:visible, h1.sr-only').count()
    expect(visibleH1, `${path} h1 count`).toBeGreaterThanOrEqual(1)
    expect(await page.locator('main').count(), `${path} main`).toBe(1)
    expect(await page.title(), `${path} title`).toMatch(/ \| Anchor Exchange$/)
  }
})

test('skip link is the first tab stop and jumps focus to main', async ({ page }) => {
  await page.goto('/signin')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('main-content')
})
