import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileAuthHeader } from '../MobileAuthHeader'

vi.mock('@/hooks/ui/useShouldAnimate', () => ({
  useShouldAnimateLight: () => false,
}))

vi.mock('@/assets/marque/logo.png', () => ({
  default: '/mock-logo.png',
}))

describe('MobileAuthHeader', () => {
  it('renders logo with alt text', () => {
    render(<MobileAuthHeader />)
    expect(screen.getByAltText('OpenPulse')).toBeInTheDocument()
  })

  it('renders subtitle', () => {
    render(<MobileAuthHeader />)
    expect(screen.getByText('Plateforme de gestion intelligente')).toBeInTheDocument()
  })

  it('renders with lg:hidden class', () => {
    const { container } = render(<MobileAuthHeader />)
    expect(container.firstElementChild?.className).toContain('lg:hidden')
  })

  it('reste plat, sans vague, halo, dégradé ni ombre', () => {
    const { container } = render(<MobileAuthHeader />)

    expect(container.querySelector('svg')).not.toBeInTheDocument()
    expect(container.innerHTML).not.toMatch(
      /bg-gradient|backdrop-blur|drop-shadow|blur-(?:sm|md|lg|xl|2xl|3xl)/
    )
  })
})
