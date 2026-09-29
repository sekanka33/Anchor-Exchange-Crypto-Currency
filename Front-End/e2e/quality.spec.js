import { test, expect } from '@playwright/test'
import { createUser, loginViaStorage } from './support.js'

const PUBLIC = ['/', '/markets', '/exchange', '/signin', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/qr-auth', '/contact', '/overview', '/withdrawals/confirm']
const AUTHED = ['/buy-crypto', '/sell-crypto', '/wallet', '/dashboard', '/orderstrades', '/notifications', '/deposit', '/deposit/crypto', '/withdraw', '/withdraw/crypto', '/transactions', '/admin', '/profile-setting']

// Third parties we can't control (TradingView widgets, CDN images, fonts).
const THIRD_PARTY = /tradingview|coingecko|binance|googleapis|gstatic|qrserver|cloudflare|s3\.tradingview/i

test.describe('no console or page errors', () => {
  test('every page loads without console errors, uncaught exceptions, or failed first-party requests', async ({ page }) => {
    test.setTimeout(90_000) // walks 25 full page loads against the real backend; 45s default is too tight and flakes near the boundary
    const user = await createUser({ role: 'admin' })
    await loginViaStorage(page, { ...user, role: 'admin' })

    const problems = []
    let current = ''
    page.on('pageerror', (e) => problems.push(`${current}: uncaught ${e.message}`))
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const text = m.text()
      if (THIRD_PARTY.test(text) || THIRD_PARTY.test(m.location().url || '')) return
      // Emitted by the TradingView chart iframe probing browser APIs, intermittently.
      if (/Permissions policy violation/.test(text)) return
      if (/Failed to load resource/.test(text)) return // covered precisely by the response check below
      problems.push(`${current}: console.error ${text.slice(0, 160)}`)
    })
    page.on('response', (r) => {
      const url = r.url()
      if (THIRD_PARTY.test(url)) return
      if (!/localhost:(5100|5174)/.test(url)) return
      if (r.status() >= 400) problems.push(`${current}: ${r.status()} ${r.request().method()} ${url.replace(/\?.*/, '')}`)
    })
    page.on('requestfailed', (r) => {
      if (!THIRD_PARTY.test(r.url()) && /localhost:(5100|5174)/.test(r.url())) problems.push(`${current}: request failed ${r.url()}`)
    })

    for (const path of [...PUBLIC, ...AUTHED]) {
      current = path
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }

    // Pages that intentionally show an error state when opened bare (no token
    // in the URL) legitimately produce a 400 — those are not defects.
    const ignorable = /(verify-email|reset-password|withdrawals\/confirm|qr-auth)/
    expect(problems.filter((p) => !ignorable.test(p.split(':')[0]))).toEqual([])
  })
})

test.describe('responsive: no horizontal overflow', () => {
  for (const width of [375, 768, 1280, 1920]) {
    test(`${width}px wide`, async ({ page }) => {
      const user = await createUser()
      await loginViaStorage(page, user)
      await page.setViewportSize({ width, height: 900 })

      const overflowing = []
      for (const path of [...PUBLIC, ...AUTHED.filter((p) => p !== '/admin')]) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        if (over > 1) overflowing.push(`${path} (+${over}px)`)
      }
      expect(overflowing).toEqual([])
    })
  }
})
