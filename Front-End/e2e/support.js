import { createRequire } from 'node:module'
import crypto from 'node:crypto'

// Reuse the backend's own pg + dotenv rather than duplicating the dependency.
const require = createRequire(new URL('../../Back-End/package.json', import.meta.url))
process.env.DB_NAME = process.env.TEST_DB_NAME || 'anchor_exchange_test'
require('dotenv').config({ path: new URL('../../Back-End/.env', import.meta.url).pathname, quiet: true })
process.env.DB_NAME = process.env.TEST_DB_NAME || 'anchor_exchange_test'

if (!/_test$/.test(process.env.DB_NAME)) {
  throw new Error(`E2E refuses to touch database "${process.env.DB_NAME}"`)
}

const { Pool } = require('pg')
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

export const API = 'http://localhost:5100'
export const PASSWORD = 'E2eTestPassw0rd!'

export const uniqueEmail = (prefix = 'e2e') => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@test.local`

export const api = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

// Real register + login through the API; only the email-verification step is
// shortcut in the DB (there's no inbox in tests).
export const createUser = async ({ role = 'user' } = {}) => {
  const email = uniqueEmail()
  const reg = await api('POST', '/api/auth/register', {
    body: { email, password: PASSWORD, fullName: 'E2e', surname: 'Tester', country: 'ZA', phoneNumber: '+27123456789' },
  })
  if (reg.status !== 201) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`)
  const id = reg.body.user.id
  await pool.query('UPDATE users SET is_verified = true, role = $2 WHERE id = $1', [id, role])
  const login = await api('POST', '/api/auth/login', { body: { email, password: PASSWORD } })
  return { id, email, password: PASSWORD, token: login.body.token }
}

// Test funding is posted through the backend's ledger, like every real
// balance change, so balances and ledger stay reconciled.
const ledger = require('./services/ledger.js')
export const fund = async (userId, asset, amount) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await ledger.postJournal(client, {
      key: `test-funding:${crypto.randomUUID()}`,
      kind: 'TEST_FUNDING',
      entries: [
        { account: 'external:test-funding', asset, amount: `-${amount}` },
        { account: ledger.account.available(userId), asset, amount: String(amount) },
      ],
    })
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const balance = async (userId, asset) => {
  const r = await pool.query(
    `SELECT available_balance a, locked_balance l FROM wallet_balances wb JOIN wallets w ON w.id = wb.wallet_id WHERE w.user_id = $1 AND wb.asset_symbol = $2`,
    [userId, asset],
  )
  return { available: Number(r.rows[0]?.a || 0), locked: Number(r.rows[0]?.l || 0) }
}

// Logs the browser in the way the app itself does: a JWT in localStorage.
export const loginViaStorage = async (page, user, theme = 'dark') => {
  await page.addInitScript(
    ([token, id, role, th]) => {
      localStorage.setItem('token', token)
      localStorage.setItem('userId', String(id))
      localStorage.setItem('role', role)
      localStorage.setItem('theme', th)
    },
    [user.token, user.id, user.role || 'user', theme],
  )
}
