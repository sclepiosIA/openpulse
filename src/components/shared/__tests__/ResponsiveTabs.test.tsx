import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResponsiveTabs } from '../ResponsiveTabs'

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}))

const tabs = [
  { value: 'tab1', label: 'Premier' },
  { value: 'tab2', label: 'Deuxième' },
  { value: 'tab3', label: 'Troisième' },
]

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('ResponsiveTabs', () => {
  it('renders all tabs', () => {
    wrap(<ResponsiveTabs tabs={tabs} value="tab1" onValueChange={vi.fn()} />)
    expect(screen.getByText('Premier')).toBeInTheDocument()
    expect(screen.getByText('Deuxième')).toBeInTheDocument()
    expect(screen.getByText('Troisième')).toBeInTheDocument()
  })

  it('renders with badge', () => {
    const tabsWithBadge = [
      { value: 'a', label: 'Alpha', badge: 5 },
      { value: 'b', label: 'Beta' },
    ]
    wrap(<ResponsiveTabs tabs={tabsWithBadge} value="a" onValueChange={vi.fn()} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
