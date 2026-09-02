import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeploymentViewSelectorCompact } from '../DeploymentViewSelectorCompact'

describe('DeploymentViewSelectorCompact', () => {
  it('renders all 3 view buttons', () => {
    render(<DeploymentViewSelectorCompact currentView="list" onViewChange={vi.fn()} />)
    expect(screen.getByTitle('Liste')).toBeInTheDocument()
    expect(screen.getByTitle('Chronologie')).toBeInTheDocument()
    expect(screen.getByTitle('Gantt')).toBeInTheDocument()
  })

  it('calls onViewChange when button clicked', () => {
    const onChange = vi.fn()
    render(<DeploymentViewSelectorCompact currentView="list" onViewChange={onChange} />)
    fireEvent.click(screen.getByTitle('Gantt'))
    expect(onChange).toHaveBeenCalledWith('gantt')
  })

  it('highlights active view', () => {
    render(<DeploymentViewSelectorCompact currentView="timeline" onViewChange={vi.fn()} />)
    expect(screen.getByTitle('Chronologie').className).toContain('bg-card')
  })
})
