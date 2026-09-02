import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamFiltersBar } from '../TeamFiltersBar'

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

describe('TeamFiltersBar', () => {
  const defaultFilters = {
    search: '',
    role: 'all' as const,
    status: 'all' as const,
    workload: 'all' as const,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
  }

  it('renders search input', () => {
    render(<TeamFiltersBar filters={defaultFilters} onFilterChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.getByPlaceholderText('Rechercher par nom ou email...')).toBeInTheDocument()
  })

  it('calls onFilterChange on search input', () => {
    const onFilterChange = vi.fn()
    render(
      <TeamFiltersBar filters={defaultFilters} onFilterChange={onFilterChange} onReset={vi.fn()} />
    )
    fireEvent.change(screen.getByPlaceholderText('Rechercher par nom ou email...'), {
      target: { value: 'test' },
    })
    expect(onFilterChange).toHaveBeenCalledWith('search', 'test')
  })

  it('does not show reset button when no filters active', () => {
    render(<TeamFiltersBar filters={defaultFilters} onFilterChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.queryByText('Réinitialiser les filtres')).not.toBeInTheDocument()
  })

  it('shows reset button when filters are active', () => {
    const activeFilters = { ...defaultFilters, search: 'test' }
    render(<TeamFiltersBar filters={activeFilters} onFilterChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.getByText('Réinitialiser les filtres')).toBeInTheDocument()
  })

  it('calls onReset when reset clicked', () => {
    const onReset = vi.fn()
    const activeFilters = { ...defaultFilters, role: 'admin' as const }
    render(<TeamFiltersBar filters={activeFilters} onFilterChange={vi.fn()} onReset={onReset} />)
    fireEvent.click(screen.getByText('Réinitialiser les filtres'))
    expect(onReset).toHaveBeenCalled()
  })
})
