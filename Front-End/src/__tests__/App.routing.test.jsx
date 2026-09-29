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
    localStorage.setItem('token', 'jwt')
    renderAt('/wallet')
    await waitFor(() => expect(document.title).toBe('Wallet | Anchor Exchange'))
  })
})
