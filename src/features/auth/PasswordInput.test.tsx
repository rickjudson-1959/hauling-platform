import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PasswordInput from './PasswordInput'

describe('PasswordInput', () => {
  it('toggles visibility and updates the accessible name', async () => {
    const user = userEvent.setup()
    render(
      <label htmlFor="secret">
        Password
        <PasswordInput id="secret" value="secret" onChange={() => {}} />
      </label>,
    )

    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')

    const toggle = screen.getByRole('button', { name: 'Show password' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'secret')

    await user.click(toggle)

    expect(input).toHaveAttribute('type', 'text')
    const hideToggle = screen.getByRole('button', { name: 'Hide password' })
    expect(hideToggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not submit a parent form when the toggle is clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <PasswordInput value="secret" onChange={() => {}} />
        <button type="submit">Save</button>
      </form>,
    )

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
