import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProductionViewSelectorCompact } from '../ProductionViewSelectorCompact'

describe('ProductionViewSelectorCompact', () => {
  it('renders all 5 view buttons', () => {
    render(<ProductionViewSelectorCompact currentView="grid" onViewChange={vi.fn()} />)
    expect(screen.getByTitle('Grille')).toBeInTheDocument()
    expect(screen.getByTitle('Liste')).toBeInTheDocument()
    expect(screen.getByTitle('Analytique')).toBeInTheDocument()
    expect(screen.getByTitle('Chrono')).toBeInTheDocument()
    expect(screen.getByTitle('Cohortes')).toBeInTheDocument()
  })

  it('calls onViewChange when button clicked', () => {
    const onChange = vi.fn()
    render(<ProductionViewSelectorCompact currentView="grid" onViewChange={onChange} />)
    fireEvent.click(screen.getByTitle('Cohortes'))
    expect(onChange).toHaveBeenCalledWith('cohorts')
  })

  it('highlights active view', () => {
    render(<ProductionViewSelectorCompact currentView="analytics" onViewChange={vi.fn()} />)
    const activeBtn = screen.getByTitle('Analytique')
    expect(activeBtn.className).toContain('bg-card')
  })
})
