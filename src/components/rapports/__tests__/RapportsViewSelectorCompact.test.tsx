import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RapportsViewSelectorCompact } from '../RapportsViewSelectorCompact'

describe('RapportsViewSelectorCompact', () => {
  it('renders all 5 view buttons', () => {
    render(<RapportsViewSelectorCompact currentView="dashboard" onViewChange={vi.fn()} />)
    expect(screen.getByTitle('Dashboard')).toBeInTheDocument()
    expect(screen.getByTitle('Graphiques')).toBeInTheDocument()
    expect(screen.getByTitle('Tableau')).toBeInTheDocument()
    expect(screen.getByTitle('Évolution')).toBeInTheDocument()
    expect(screen.getByTitle('Objectifs')).toBeInTheDocument()
  })

  it('calls onViewChange when clicked', () => {
    const onChange = vi.fn()
    render(<RapportsViewSelectorCompact currentView="dashboard" onViewChange={onChange} />)
    fireEvent.click(screen.getByTitle('Tableau'))
    expect(onChange).toHaveBeenCalledWith('table')
  })

  it('highlights active view', () => {
    render(<RapportsViewSelectorCompact currentView="charts" onViewChange={vi.fn()} />)
    expect(screen.getByTitle('Graphiques').className).toContain('bg-card')
  })
})
