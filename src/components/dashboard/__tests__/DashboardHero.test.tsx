import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardHero } from '../DashboardHero'

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}))

vi.mock('@/hooks/ui/useShouldAnimate', () => ({
  useShouldAnimate: () => false,
}))

vi.mock('@/components/search/GlobalSearchDialog', () => ({
  GlobalSearchDialog: () => null,
}))

const defaultProps = {
  totalEtablissements: 42,
  totalValeur: 2500000,
  conversionRate: 65,
  prospects: 12,
  production: 20,
  contractuels: 10,
}

describe('DashboardHero', () => {
  const renderWithRouter = (props = defaultProps) =>
    render(
      <MemoryRouter>
        <DashboardHero {...props} />
      </MemoryRouter>
    )

  it('renders CA metric', () => {
    renderWithRouter()
    expect(screen.getByText('CA Potentiel')).toBeInTheDocument()
    expect(screen.getByText('2.5M€')).toBeInTheDocument()
  })

  it('renders établissements count', () => {
    renderWithRouter()
    expect(screen.getByText('Établissements')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders conversion rate', () => {
    renderWithRouter()
    expect(screen.getByText('Taux de Conversion')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()
  })

  it('renders prospects and contractuels in subtext', () => {
    renderWithRouter()
    expect(screen.getByText('12 prospects • 10 contrats')).toBeInTheDocument()
  })

  it('renders toolbar actions when provided', () => {
    render(
      <MemoryRouter>
        <DashboardHero {...defaultProps} toolbarActions={<button>Custom Action</button>} />
      </MemoryRouter>
    )
    expect(screen.getByText('Custom Action')).toBeInTheDocument()
  })

  it('expose chaque indicateur comme une action accessible au clavier', () => {
    renderWithRouter()

    for (const name of [
      /^CA Potentiel : 2\.5M€/i,
      /^Établissements : 42\./i,
      /^Taux de Conversion : 65%/i,
      /^En Production : 20\./i,
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })
})
