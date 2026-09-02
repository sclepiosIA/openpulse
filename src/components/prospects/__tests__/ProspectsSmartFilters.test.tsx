import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProspectsSmartFilters } from '../ProspectsSmartFilters'

describe('ProspectsSmartFilters', () => {
  it('renders all filter labels', () => {
    render(<ProspectsSmartFilters activeFilter="all" onFilterChange={vi.fn()} />)
    expect(screen.getByText('Tous')).toBeInTheDocument()
    expect(screen.getByText('Chauds')).toBeInTheDocument()
    expect(screen.getByText('Récents')).toBeInTheDocument()
    expect(screen.getByText('En pause')).toBeInTheDocument()
    expect(screen.getByText('Fort potentiel')).toBeInTheDocument()
  })

  it('calls onFilterChange when clicked', () => {
    const onFilterChange = vi.fn()
    render(<ProspectsSmartFilters activeFilter="all" onFilterChange={onFilterChange} />)
    fireEvent.click(screen.getByText('Chauds'))
    expect(onFilterChange).toHaveBeenCalledWith('hot')
  })

  it('highlights active filter with bg-card', () => {
    render(<ProspectsSmartFilters activeFilter="hot" onFilterChange={vi.fn()} />)
    const hotEl = screen.getByText('Chauds').closest('div')
    expect(hotEl?.className).toContain('bg-card')
  })

  it('renders counts when provided', () => {
    const counts = { all: 50, hot: 12, recent: 5, stalled: 3, high_value: 8 }
    const { container } = render(
      <ProspectsSmartFilters activeFilter="all" onFilterChange={vi.fn()} counts={counts} />
    )
    // Counts rendered in spans like "(50)"
    expect(container.textContent).toContain('50')
    expect(container.textContent).toContain('12')
  })

  it('renders compact mode', () => {
    const { container } = render(
      <ProspectsSmartFilters activeFilter="all" onFilterChange={vi.fn()} compact />
    )
    expect(container.firstChild).toBeInTheDocument()
  })
})
