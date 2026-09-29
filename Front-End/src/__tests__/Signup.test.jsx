import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Signup from '../Pages/Signup'

const json = (body, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) })

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ message: 'User created. Please check your email.' }, true, 201))
})

const renderSignup = () => render(<MemoryRouter><Signup /></MemoryRouter>)

const fill = async (user, overrides = {}) => {
  const v = { email: 'ada@example.com', fullName: 'Ada', surname: 'Lovelace', country: 'UK', phoneNumber: '+27123456789', password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass', ...overrides }
  await user.type(screen.getByLabelText('Email'), v.email)
  await user.type(screen.getByLabelText('Full names'), v.fullName)
  await user.type(screen.getByLabelText('Surname'), v.surname)
  await user.type(screen.getByLabelText('Country'), v.country)
  await user.type(screen.getByLabelText('Phone number'), v.phoneNumber)
  await user.type(screen.getByLabelText('Password'), v.password)
  await user.type(screen.getByLabelText('Confirm password'), v.confirmPassword)
}

const submit = (user) => user.click(screen.getByRole('button', { name: /register|sign up|create/i }))

describe('Signup page', () => {
  it('labels every field and sets autocomplete tokens', () => {
    renderSignup()
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('autocomplete', 'tel')
  })

  it('a valid form POSTs exactly the registration fields (never the confirm-password) and reports success via role="status"', async () => {
    const user = userEvent.setup()
    renderSignup()
    await fill(user)
    await submit(user)

    expect(await screen.findByRole('status')).toHaveTextContent(/user created/i)
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(String(url)).toContain('/api/auth/register')
    expect(JSON.parse(init.body)).toEqual({
      email: 'ada@example.com', password: 'Str0ng!Pass', fullName: 'Ada', surname: 'Lovelace', country: 'UK', phoneNumber: '+27123456789',
    })
  })

  it('blocks a weak password client-side, announces why, and sends nothing', async () => {
    const user = userEvent.setup()
    renderSignup()
    await fill(user, { password: 'weakpass', confirmPassword: 'weakpass' })
    await submit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(/8\+ characters, uppercase, lowercase, number and special/i)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('blocks mismatched passwords', async () => {
    const user = userEvent.setup()
    renderSignup()
    await fill(user, { confirmPassword: 'Different1!' })
    await submit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  for (const [name, overrides, message] of [
    ['digits in the name', { fullName: 'Ada99' }, /only contain letters/i],
    ['a malformed phone number', { phoneNumber: 'abc' }, /valid phone number/i],
  ]) {
    it(`rejects ${name} before calling the server`, async () => {
      const user = userEvent.setup()
      renderSignup()
      await fill(user, overrides)
      await submit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })
  }

  it('an invalid email is stopped by native form validation before any request is made', async () => {
    const user = userEvent.setup()
    renderSignup()
    await fill(user, { email: 'not-an-email' })
    await submit(user)

    expect(screen.getByLabelText('Email')).toBeInvalid()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('surfaces a server-side rejection (e.g. duplicate email)', async () => {
    globalThis.fetch.mockImplementation(() => json({ message: 'An account with that email already exists' }, false, 409))
    const user = userEvent.setup()
    renderSignup()
    await fill(user)
    await submit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('An account with that email already exists')
  })

  it('shows live password-strength feedback as the user types', async () => {
    const user = userEvent.setup()
    renderSignup()
    const item = (text) => screen.getByText(new RegExp(text, 'i'))

    expect(item('Uppercase letter').className).toContain('text-gray-500')
    await user.type(screen.getByLabelText('Password'), 'Abc')
    expect(item('Uppercase letter').className).toContain('text-green-700')
    expect(item('Minimum 8 characters').className).toContain('text-gray-500')
  })
})
