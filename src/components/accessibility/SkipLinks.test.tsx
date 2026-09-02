/* @vitest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SkipLinks } from './SkipLinks'

describe('SkipLinks', () => {
  it('renders both skip links with correct accessible names and targets', () => {
    render(<SkipLinks />)

    const mainContentLink = screen.getByRole('link', { name: 'Aller au contenu principal' })
    const navigationLink = screen.getByRole('link', { name: 'Aller à la navigation' })

    expect(mainContentLink).toBeInTheDocument()
    expect(mainContentLink).toHaveAttribute('href', '#main-content')

    expect(navigationLink).toBeInTheDocument()
    expect(navigationLink).toHaveAttribute('href', '#main-navigation')
  })

  it('applies accessibility and positioning classes to the container and links', () => {
    const { container } = render(<SkipLinks />)

    const wrapper = container.firstElementChild
    const mainContentLink = screen.getByRole('link', { name: 'Aller au contenu principal' })
    const navigationLink = screen.getByRole('link', { name: 'Aller à la navigation' })

    expect(wrapper).toHaveClass('sr-only')
    expect(wrapper).toHaveClass('focus-within:not-sr-only')

    expect(mainContentLink).toHaveClass('fixed', 'top-2', 'left-2', 'z-[100]', '-translate-y-16', 'focus:translate-y-0')
    expect(navigationLink).toHaveClass('fixed', 'top-2', 'left-48', 'z-[100]', '-translate-y-16', 'focus:translate-y-0')
  })

  it('allows keyboard users to focus the skip links in order', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button type="button">Avant</button>
        <SkipLinks />
        <button type="button">Après</button>
      </div>,
    )

    await user.tab()
    expect(screen.getByRole('button', { name: 'Avant' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('link', { name: 'Aller au contenu principal' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('link', { name: 'Aller à la navigation' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Après' })).toHaveFocus()
  })
})