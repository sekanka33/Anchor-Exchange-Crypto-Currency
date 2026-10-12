import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute, { CustomerRoute } from '../Components/ProtectedRoute'
import { AuthProvider } from '../Components/AuthProvider'

const json = (body, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })

// What GET /api/users/profile answers for the stored token.
let profile
beforeEach(() => {
  profile = () => json({ user: { id: 7, email: 'u@test.local', role: 'user' } })
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
    String(url).includes('/api/users/profile') ? profile() : Promise.reject(new Error('unexpected'))
  )
})

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/signin" element={<p>Sign in page</p>} />
          <Route path="/dashboard" element={<p>User home</p>} />
          <Route path="/secret" element={<ProtectedRoute role="user"><p>Secret content</p></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute role="admin"><p>Admin content</p></ProtectedRoute>} />
          <Route path="/markets" element={<CustomerRoute><p>Markets content</p></CustomerRoute>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )

describe('ProtectedRoute', () => {
  it('redirects to /signin when there is no token, without asking the server', () => {
    renderAt('/secret')
    expect(screen.getByText('Sign in page')).toBeInTheDocument()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('treats an empty-string token as logged out', () => {
    localStorage.setItem('token', '')
    renderAt('/secret')
    expect(screen.getByText('Sign in page')).toBeInTheDocument()
  })

  it('waits for the server to confirm the session before rendering', async () => {
    localStorage.setItem('token', 'abc')
    renderAt('/secret')
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument()
    expect(await screen.findByText('Secret content')).toBeInTheDocument()
  })

  it('sends a user who opens an admin route to their own home', async () => {
    localStorage.setItem('token', 'abc')
    renderAt('/admin')
    expect(await screen.findByText('User home')).toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })

  it('ignores a role tampered into localStorage: only the server decides', async () => {
    localStorage.setItem('token', 'abc')
    localStorage.setItem('role', 'admin')
    renderAt('/admin')
    expect(await screen.findByText('User home')).toBeInTheDocument()
  })

  it('sends an admin away from customer pages, public or private', async () => {
    profile = () => json({ user: { id: 1, email: 'a@test.local', role: 'admin' } })
    localStorage.setItem('token', 'abc')
    renderAt('/markets')
    expect(await screen.findByText('Admin content')).toBeInTheDocument()
    expect(screen.queryByText('Markets content')).not.toBeInTheDocument()
  })

  it('drops an expired session and sends the visitor to sign in', async () => {
    profile = () => json({ message: 'Invalid or expired token.' }, 401)
    localStorage.setItem('token', 'stale')
    renderAt('/secret')
    expect(await screen.findByText('Sign in page')).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('fails safe when the session cannot be verified: no content, a retry button', async () => {
    profile = () => Promise.reject(new Error('offline'))
    localStorage.setItem('token', 'abc')
    renderAt('/secret')
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument()
  })
})
