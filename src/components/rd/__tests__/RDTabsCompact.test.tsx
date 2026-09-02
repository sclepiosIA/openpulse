import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RDTabsCompact } from '@/components/rd/RDTabsCompact'

describe('RDTabsCompact', () => {
  it('should render all 5 tabs', () => {
    render(<RDTabsCompact currentTab="dashboard" onTabChange={vi.fn()} />)
    expect(screen.getByTitle('Dashboard')).toBeInTheDocument()
    expect(screen.getByTitle('Backlog')).toBeInTheDocument()
    expect(screen.getByTitle('Kanban')).toBeInTheDocument()
    expect(screen.getByTitle('Gantt')).toBeInTheDocument()
    expect(screen.getByTitle('Analytics')).toBeInTheDocument()
  })

  it('should call onTabChange when a tab is clicked', () => {
    const onTabChange = vi.fn()
    render(<RDTabsCompact currentTab="dashboard" onTabChange={onTabChange} />)
    fireEvent.click(screen.getByTitle('Backlog'))
    expect(onTabChange).toHaveBeenCalledWith('backlog')
  })

  it('should highlight the active tab', () => {
    render(<RDTabsCompact currentTab="kanban" onTabChange={vi.fn()} />)
    const kanbanBtn = screen.getByTitle('Kanban')
    expect(kanbanBtn.className).toContain('bg-card')
  })

  it('should not highlight inactive tabs', () => {
    render(<RDTabsCompact currentTab="kanban" onTabChange={vi.fn()} />)
    const dashboardBtn = screen.getByTitle('Dashboard')
    expect(dashboardBtn.className).not.toContain('bg-card text-primary')
  })
})
