import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProspectsViewSelector } from '../ProspectsViewSelector'

describe('ProspectsViewSelector', () => {
  it('renders all 4 view buttons', () => {
    render(<ProspectsViewSelector currentView="grid" onViewChange={vi.fn()} />)
    expect(screen.getByLabelText('Afficher les prospects en grille')).toBeInTheDocument()
    expect(screen.getByLabelText('Afficher les prospects en liste')).toBeInTheDocument()
    expect(screen.getByLabelText('Afficher les prospects en tableau')).toBeInTheDocument()
    expect(screen.getByLabelText('Afficher les prospects en Kanban')).toBeInTheDocument()
  })

  it('calls onViewChange when button clicked', () => {
    const onChange = vi.fn()
    render(<ProspectsViewSelector currentView="grid" onViewChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Afficher les prospects en Kanban'))
    expect(onChange).toHaveBeenCalledWith('kanban')
  })

  it('applies compact class when compact=true', () => {
    const { container } = render(
      <ProspectsViewSelector currentView="grid" onViewChange={vi.fn()} compact />
    )
    expect(container.querySelector('.h-6')).toBeInTheDocument()
  })

  it('applies default variant styling', () => {
    const { container } = render(
      <ProspectsViewSelector currentView="grid" onViewChange={vi.fn()} variant="default" />
    )
    expect(container.querySelector('.bg-muted\\/50')).toBeInTheDocument()
  })
})
