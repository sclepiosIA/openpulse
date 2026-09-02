import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarContentToggle, type ContentFilters } from '../CalendarContentToggle'

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: () => ({ data: [{ id: 'c1', nom: 'Déploiement', couleur: '#ff0000' }] }),
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

const defaultFilters: ContentFilters = {
  showTasks: true,
  showEvents: true,
  showAbsences: false,
  showEstablishmentTasks: false,
  selectedCategories: [],
}

describe('CalendarContentToggle', () => {
  it('renders filter buttons', () => {
    render(<CalendarContentToggle filters={defaultFilters} onChange={vi.fn()} />)
    expect(screen.getByText('Tâches')).toBeInTheDocument()
    expect(screen.getByText('Évén.')).toBeInTheDocument()
    expect(screen.getByText('Abs.')).toBeInTheDocument()
  })

  it('toggles task filter', () => {
    const onChange = vi.fn()
    render(<CalendarContentToggle filters={defaultFilters} onChange={onChange} />)
    fireEvent.click(screen.getByText('Tâches'))
    expect(onChange).toHaveBeenCalledWith({ ...defaultFilters, showTasks: false })
  })

  it('toggles events filter', () => {
    const onChange = vi.fn()
    render(<CalendarContentToggle filters={defaultFilters} onChange={onChange} />)
    fireEvent.click(screen.getByText('Évén.'))
    expect(onChange).toHaveBeenCalledWith({ ...defaultFilters, showEvents: false })
  })

  it('shows task count badge', () => {
    render(<CalendarContentToggle filters={defaultFilters} onChange={vi.fn()} taskCount={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders category filter button', () => {
    render(<CalendarContentToggle filters={defaultFilters} onChange={vi.fn()} />)
    expect(screen.getByText('Cat.')).toBeInTheDocument()
  })
})
