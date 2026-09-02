import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PhaseNavTabs } from '../PhaseNavTabs'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

describe('PhaseNavTabs', () => {
  it('renders 3 phase tabs', () => {
    const { container } = render(
      <MemoryRouter>
        <PhaseNavTabs activePhase="commercial" />
      </MemoryRouter>
    )
    expect(container.querySelectorAll('button').length).toBe(3)
  })

  it('highlights active tab', () => {
    const { container } = render(
      <MemoryRouter>
        <PhaseNavTabs activePhase="deploiement" />
      </MemoryRouter>
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons[1].className).toContain('bg-card')
  })

  it('renders counts when provided', () => {
    render(
      <MemoryRouter>
        <PhaseNavTabs
          activePhase="commercial"
          counts={{ commercial: 12, deploiement: 5, production: 20 }}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('navigates on inactive tab click', () => {
    const { container } = render(
      <MemoryRouter>
        <PhaseNavTabs activePhase="commercial" />
      </MemoryRouter>
    )
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[1]) // deploiement
    expect(navigate).toHaveBeenCalledWith('/deploiement')
  })
})
