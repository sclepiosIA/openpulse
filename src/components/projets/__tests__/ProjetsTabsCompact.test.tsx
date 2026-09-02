import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjetsTabsCompact } from '../ProjetsTabsCompact'

describe('ProjetsTabsCompact', () => {
  it('renders all 4 tab buttons', () => {
    render(<ProjetsTabsCompact currentTab="list" onTabChange={vi.fn()} />)
    expect(screen.getByTitle('Liste')).toBeInTheDocument()
    expect(screen.getByTitle('Tableau')).toBeInTheDocument()
    expect(screen.getByTitle('Kanban')).toBeInTheDocument()
    expect(screen.getByTitle('Analytique')).toBeInTheDocument()
  })

  it('calls onTabChange when clicked', () => {
    const onChange = vi.fn()
    render(<ProjetsTabsCompact currentTab="list" onTabChange={onChange} />)
    fireEvent.click(screen.getByTitle('Kanban'))
    expect(onChange).toHaveBeenCalledWith('kanban')
  })

  it('highlights active tab', () => {
    render(<ProjetsTabsCompact currentTab="kanban" onTabChange={vi.fn()} />)
    expect(screen.getByTitle('Kanban').className).toContain('bg-card')
  })

  it('does not highlight inactive tabs', () => {
    render(<ProjetsTabsCompact currentTab="kanban" onTabChange={vi.fn()} />)
    expect(screen.getByTitle('Liste').className).not.toContain('bg-card text-primary')
  })
})
