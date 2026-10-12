import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn(), connect: vi.fn() }),
}))
vi.mock('react-ts-tradingview-widgets', () => new Proxy({}, { get: () => () => null }))
vi.mock('html5-qrcode', () => ({ Html5Qrcode: class {}, Html5QrcodeScanner: class {} }))

import App from '../App'

beforeEach(() => {
  // Every API call fails: these tests are about the shell, and pages must
  // survive a dead backend (error state) rather than crash.
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)

describe('App shell', () => {
  it('sets a descriptive document title per route', async () => {
    renderAt('/signin')
    await waitFor(() => expect(document.title).toBe('Sign In | Anchor Exchange'))
  })

  it('falls back to the bare site title on an unknown route', async () => {
    renderAt('/no-such-page')
    await waitFor(() => expect(document.title).toBe('Anchor Exchange'))
  })

  it('renders a skip link as the first focusable element, targeting the main landmark', async () => {
    const user = userEvent.setup()
    renderAt('/signin')

    await user.tab()
    const skip = screen.getByRole('link', { name: 'Skip to main content' })
    expect(skip).toHaveFocus()
    expect(skip).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })

  it('has exactly one main landmark', () => {
    renderAt('/signin')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('redirects protected pages to /signin when logged out', async () => {
    renderAt('/wallet')
    await waitFor(() => expect(document.title).toBe('Sign In | Anchor Exchange'))
  })

  it('lets a logged-in user reach a protected page', async () => {
    mockProfile({ id: 7, email: 'u@test.local', role: 'user' })
    localStorage.setItem('token', 'jwt')
    renderAt('/wallet')
    expect(await screen.findByRole('heading', { level: 1, name: 'Wallet' })).toBeInTheDocument()
  })
})

// GET /api/users/profile answers with this user; every other call fails.
const mockProfile = (user, status = 200) =>
  globalThis.fetch.mockImplementation((url) =>
    String(url).includes('/api/users/profile')
      ? Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(status < 400 ? { user } : { message: 'Invalid or expired token.' }) })
      : Promise.reject(new Error('offline'))
  )

describe('role separation', () => {
  it('an admin who opens customer pages lands in the admin app, with no customer navbar or footer', async () => {
    mockProfile({ id: 1, email: 'admin@test.local', role: 'admin' })
    localStorage.setItem('token', 'jwt')
    for (const path of ['/', '/markets', '/wallet', '/exchange', '/profile-setting', '/no-such-page']) {
      const { unmount } = renderAt(path)
      await waitFor(() => expect(document.title).toBe('Admin | Anchor Exchange'))
      expect(screen.queryByRole('link', { name: 'Buy Crypto' })).not.toBeInTheDocument()
      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('the admin app has its own header with sign out', async () => {
    mockProfile({ id: 1, email: 'admin@test.local', role: 'admin' })
    globalThis.fetch.mockImplementation((url) => {
      if (String(url).includes('/api/users/profile')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ user: { id: 1, email: 'admin@test.local', role: 'admin' } }) })
      if (String(url).includes('/api/admin/stats')) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ message: 'Unable to load statistics' }) })
      return Promise.reject(new Error('offline'))
    })
    localStorage.setItem('token', 'jwt')
    renderAt('/admin')
    expect(await screen.findByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.getByText('admin@test.local')).toBeInTheDocument()
  })

  it('a normal user who opens /admin is sent to their dashboard', async () => {
    mockProfile({ id: 7, email: 'u@test.local', role: 'user' })
    localStorage.setItem('token', 'jwt')
    localStorage.setItem('role', 'admin') // tampering changes nothing
    renderAt('/admin')
    await waitFor(() => expect(document.title).toBe('Dashboard | Anchor Exchange'))
  })

  it('a visitor who opens /admin is asked to sign in', async () => {
    renderAt('/admin')
    await waitFor(() => expect(document.title).toBe('Sign In | Anchor Exchange'))
  })

  it('an expired session ends on sign in with an explanation', async () => {
    mockProfile(null, 401)
    localStorage.setItem('token', 'expired-jwt')
    renderAt('/wallet')
    expect(await screen.findAllByText('Your session has ended. Please sign in again.')).not.toHaveLength(0)
    expect(localStorage.getItem('token')).toBeNull()
  })
})
