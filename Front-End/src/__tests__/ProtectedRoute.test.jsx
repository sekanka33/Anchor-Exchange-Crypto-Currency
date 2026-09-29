import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../Components/ProtectedRoute'

const renderAt = (path = '/secret') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/signin" element={<p>Sign in page</p>} />
        <Route path="/secret" element={<ProtectedRoute><p>Secret content</p></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  )

describe('ProtectedRoute', () => {
  it('redirects to /signin when there is no token', () => {
    renderAt()
    expect(screen.getByText('Sign in page')).toBeInTheDocument()
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument()
  })

  it('renders children when a token is present', () => {
    localStorage.setItem('token', 'abc')
    renderAt()
    expect(screen.getByText('Secret content')).toBeInTheDocument()
  })

  it('treats an empty-string token as logged out', () => {
    localStorage.setItem('token', '')
    renderAt()
    expect(screen.getByText('Sign in page')).toBeInTheDocument()
  })
})
