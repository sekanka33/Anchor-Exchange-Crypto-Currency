import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from '../Components/Modal'

const Harness = ({ onClose = () => {} }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open details</button>
      {open && (
        <Modal onClose={() => { onClose(); setOpen(false) }} titleId="t" className="panel">
          <h3 id="t">Order #7</h3>
          <button>First action</button>
          <a href="#x">A link</a>
          <button>Last action</button>
        </Modal>
      )}
    </>
  )
}

describe('Modal', () => {
  it('is an accessible modal dialog labelled by its heading', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('Open details'))

    const dialog = screen.getByRole('dialog', { name: 'Order #7' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('moves focus into the dialog when it opens', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('Open details'))

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement)
    expect(screen.getByText('First action')).toHaveFocus()
  })

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('Open details'))

    await user.tab()
    await user.tab()
    expect(screen.getByText('Last action')).toHaveFocus()

    await user.tab()
    expect(screen.getByText('First action')).toHaveFocus()

    await user.tab({ shift: true })
    expect(screen.getByText('Last action')).toHaveFocus()
  })

  it('closes on Escape and returns focus to the element that opened it', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const opener = screen.getByText('Open details')
    await user.click(opener)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('closes when the backdrop is clicked but not when the panel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await user.click(screen.getByText('Open details'))

    await user.click(screen.getByText('Order #7'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('dialog').parentElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('removes its keyboard listener when it unmounts (no Escape handler leak)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await user.click(screen.getByText('Open details'))
    await user.keyboard('{Escape}')
    onClose.mockClear()

    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })
})
