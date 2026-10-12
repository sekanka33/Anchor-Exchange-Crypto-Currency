import { test, expect } from '@playwright/test'
import { createUser, loginViaStorage } from './support.js'

// Every route in App.jsx. /dashboard is the one route with its own full-screen
// layout (sidebar, no site navbar or footer).
const ROUTES = [
  '/', '/markets', '/exchange', '/spot', '/bitusdt', '/assets', '/overview', '/buy-crypto', '/contact', '/blog', '/faq',
  '/signin', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/qr-auth',
  '/dashboard', '/wallet', '/orderstrades', '/notifications', '/sell-crypto', '/deposit', '/deposit/crypto',
  '/withdraw', '/withdraw/crypto', '/withdrawals/confirm', '/transactions', '/profile-setting', '/admin',
  '/about', '/careers', '/no-such-page',
]
const NO_FOOTER = ['/dashboard']
const TOKEN_PAGES = ['/reset-password', '/verify-email', '/qr-auth', '/withdrawals/confirm']

const VIEWPORTS = { mobile: { width: 375, height: 667 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 900 } }

const measure = (page) =>
  page.evaluate(() => {
    const footers = document.querySelectorAll('footer')
    const main = document.getElementById('main-content')
    const docHeight = document.documentElement.scrollHeight
    const abs = (el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY }
    }
    return {
      footers: footers.length,
      footer: footers[0] ? abs(footers[0]) : null,
      main: abs(main),
      docHeight,
      viewport: window.innerHeight,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    }
  })

test.describe('footer layout', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`every route at ${name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      test.setTimeout(120_000)
      const user = await createUser({ role: 'admin' })
      await loginViaStorage(page, { ...user, role: 'admin' })
      await page.setViewportSize(viewport)

      const problems = []
      for (const path of ROUTES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const m = await measure(page)
        const expected = NO_FOOTER.includes(path) ? 0 : 1
        if (m.footers !== expected) problems.push(`${path}: ${m.footers} footers, expected ${expected}`)
        if (m.overflowX > 1) problems.push(`${path}: horizontal overflow +${m.overflowX}px`)
        // The shell fills the viewport even when the content is short.
        if (m.docHeight < m.viewport) problems.push(`${path}: page ${m.docHeight}px shorter than viewport ${m.viewport}px`)
        if (!m.footer) continue
        // Footer is the last thing on the page, never floating above the viewport bottom ...
        if (Math.abs(m.footer.bottom - m.docHeight) > 1) problems.push(`${path}: footer ends at ${m.footer.bottom}, page at ${m.docHeight}`)
        if (m.footer.bottom < m.viewport - 1) problems.push(`${path}: footer floats (ends at ${m.footer.bottom} of ${m.viewport})`)
        // ... and never overlaps the main content.
        if (m.main.bottom > m.footer.top + 1) problems.push(`${path}: main (to ${m.main.bottom}) overlaps footer (from ${m.footer.top})`)
      }
      expect(problems).toEqual([])
    })
  }

  test('short pages fill the viewport exactly, with the footer flush to the bottom', async ({ page }) => {
    // Pages whose content plus footer fits a tall desktop window must not scroll
    // at all - this is what the old min-h-screen/h-screen wrappers broke (+56px
    // navbar overshoot) and what a missing flex shell broke (footer mid-page).
    const user = await createUser()
    await loginViaStorage(page, user, 'light')
    await page.setViewportSize({ width: 1440, height: 1400 })
    for (const path of ['/forgot-password', '/verify-email', '/withdrawals/confirm', '/notifications']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const m = await measure(page)
      expect.soft(m.docHeight, `${path} page height`).toBe(m.viewport)
      expect.soft(Math.round(m.footer.bottom), `${path} footer bottom`).toBe(m.viewport)
    }
  })
})

test.describe('page content', () => {
  test('every route renders a heading and real content, and unknown URLs get a 404 page', async ({ page }) => {
    test.setTimeout(120_000)
    const user = await createUser({ role: 'admin' })
    await loginViaStorage(page, { ...user, role: 'admin' })

    const problems = []
    for (const path of ROUTES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const { h1, text } = await page.evaluate(() => ({
        h1: document.querySelector('#main-content h1')?.textContent.trim() || '',
        text: document.getElementById('main-content').innerText.trim(),
      }))
      if (!h1) problems.push(`${path}: no h1`)
      // Token-link landing pages (email/QR) legitimately show a one-line status when opened bare.
      if (text.length < 80 && !TOKEN_PAGES.includes(path)) problems.push(`${path}: only ${text.length} chars of content`)
      if (path !== '/no-such-page' && /page not found/i.test(h1)) problems.push(`${path}: renders 404`)
    }
    expect(problems).toEqual([])

    await page.goto('/no-such-page')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  })
})

test.describe('footer links', () => {
  for (const [name, viewport] of Object.entries({ mobile: VIEWPORTS.mobile, desktop: VIEWPORTS.desktop })) {
    test(`every footer link works at ${name}`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize(viewport)
      await page.goto('/')
      const footer = page.locator('footer')

      // No dead buttons: unavailable items and social icons are plain labelled text.
      await expect(footer.locator('button')).toHaveCount(0)
      await expect(footer.getByText('Soon', { exact: true }).first()).toBeVisible()
      for (const label of ['Facebook', 'WhatsApp', 'LinkedIn', 'X (Twitter)']) {
        await expect(footer.getByRole('img', { name: `${label} (coming soon)` })).toBeVisible()
      }

      const links = await footer.locator('a').evaluateAll((as) => as.map((a) => ({ label: a.textContent.trim(), href: a.getAttribute('href') })))
      expect(links).toHaveLength(12) // every footer item backed by a real route

      const problems = []
      for (const { label, href } of links) {
        await page.goto('/contact') // static page; also covers a link to the current page
        await footer.getByRole('link', { name: label, exact: true }).click()
        await page.waitForURL((url) => url.pathname + url.hash === href)
        // The URL changes before React renders the new page; wait for the render.
        if (href.includes('#')) await expect(page.locator(href.slice(href.indexOf('#')))).toBeVisible()
        else await expect.poll(() => page.evaluate(() => window.scrollY), { message: `${label} -> ${href}: landed mid-page` }).toBe(0)
        await expect(page.locator('#main-content h1').first()).toBeAttached()
        const h1 = (await page.locator('#main-content h1').first().textContent()).trim()
        if (/page not found/i.test(h1)) problems.push(`${label} -> ${href}: 404`)
        if (href.includes('#')) {
          // Opens and scrolls to the matching FAQ answer.
          const item = page.locator(href.slice(href.indexOf('#')))
          if ((await item.getByRole('button').getAttribute('aria-expanded')) !== 'true') problems.push(`${label}: FAQ not expanded`)
          if (!(await item.isVisible()) || !(await item.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight }))) problems.push(`${label}: FAQ not scrolled into view`)
        }
      }
      expect(problems).toEqual([])
    })
  }
})
