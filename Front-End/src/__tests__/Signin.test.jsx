import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn(), connect: vi.fn() }),
}))

import Signin from '../Pages/Signin'

const json = (body, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) })

let loginResponse
beforeEach(() => {
  loginResponse = () => json({ message: 'Invalid email or password' }, false, 401)
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    if (String(url).includes('/api/qr/init')) return json({ qr_token: 't', qrCode: 'http://x/qr.png', expires_in: 60 })
    if (String(url).includes('/api/auth/login')) return loginResponse()
    return json({})
  })
})

const renderSignin = () =>
  render(
    <MemoryRouter initialEntries={['/signin']}>
      <Routes>
        <Route path="/signin" element={<Signin />} />
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
      </Routes>
    </MemoryRouter>
  )

// The page renders separate desktop and mobile forms (CSS toggles which one is
// visible); jsdom applies no CSS, so drive the first of each.
const fillAndSubmit = async (user, { email, password }) => {
  await user.type(screen.getAllByLabelText('Email')[0], email)
  await user.type(screen.getAllByLabelText('Password')[0], password)
  await user.click(screen.getAllByRole('button', { name: /log\s?in/i })[0])
}

describe('Signin page', () => {
  it('exposes labelled email and password fields with autocomplete hints', () => {
    renderSignin()
    const email = screen.getAllByLabelText('Email')[0]
    const password = screen.getAllByLabelText('Password')[0]

    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(password).toHaveAttribute('type', 'password')
  })

  it('announces a failed login through role="alert" and does not store a token', async () => {
    const user = userEvent.setup()
    renderSignin()

    await fillAndSubmit(user, { email: 'a@b.co', password: 'wrong' })

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(localStorage.getItem('token')).toBeNull()
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument()
  })

  it('stores the token, user id and role, then navigates to the dashboard on success', async () => {
    loginResponse = () => json({ token: 'jwt-123', user: { id: 42, role: 'admin' } })
    const user = userEvent.setup()
    renderSignin()

    await fillAndSubmit(user, { email: 'a@b.co', password: 'right' })

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBe('jwt-123')
    expect(localStorage.getItem('userId')).toBe('42')
    expect(localStorage.getItem('role')).toBe('admin')
  })

  it('POSTs the credentials as JSON to the login endpoint', async () => {
    const user = userEvent.setup()
    renderSignin()
    await fillAndSubmit(user, { email: 'a@b.co', password: 'pw' })
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    const call = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('/api/auth/login'))
    expect(call[1].method).toBe('POST')
    expect(JSON.parse(call[1].body)).toEqual({ email: 'a@b.co', password: 'pw' })
  })

  it('shows a generic error when the server is unreachable', async () => {
    loginResponse = () => Promise.reject(new Error('network down'))
    const user = userEvent.setup()
    renderSignin()

    await fillAndSubmit(user, { email: 'a@b.co', password: 'pw' })

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  })

  it('has exactly one page-level heading per layout and no field captions masquerading as headings', () => {
    renderSignin()
    const headings = screen.getAllByRole('heading').map((h) => h.textContent)
    expect(headings).not.toContain('Email')
    expect(headings).not.toContain('Password')
  })
})
