import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContratsTabsCompact } from '@/components/contrats/ContratsTabsCompact'

describe('ContratsTabsCompact', () => {
  it('should render all 4 tabs', () => {
    render(<ContratsTabsCompact activeTab="dashboard" onTabChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(4)
  })

  it('should call onTabChange when tab clicked', () => {
    const onChange = vi.fn()
    render(<ContratsTabsCompact activeTab="dashboard" onTabChange={onChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1]) // "contrats" tab
    expect(onChange).toHaveBeenCalledWith('contrats')
  })

  it('should highlight active tab', () => {
    render(<ContratsTabsCompact activeTab="contrats" onTabChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[1].className).toContain('bg-card')
  })

  it('should render badge for alertes', () => {
    render(
      <ContratsTabsCompact activeTab="dashboard" onTabChange={vi.fn()} badges={{ alertes: 5 }} />
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('should render 99+ for large badge values', () => {
    render(
      <ContratsTabsCompact activeTab="dashboard" onTabChange={vi.fn()} badges={{ alertes: 150 }} />
    )
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('should not render badge span when value is 0', () => {
    render(
      <ContratsTabsCompact activeTab="dashboard" onTabChange={vi.fn()} badges={{ alertes: 0 }} />
    )
    // Badge span should not exist (falsy check in component)
    const badges = screen.queryAllByText(/^\d+$/)
    const zeroBadge = badges.find(
      (el) => el.textContent === '0' && el.className.includes('rounded-full')
    )
    expect(zeroBadge).toBeUndefined()
  })
})
