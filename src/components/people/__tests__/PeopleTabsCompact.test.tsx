import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PeopleTabsCompact } from '../PeopleTabsCompact'

describe('PeopleTabsCompact', () => {
  const onTabChange = vi.fn()

  it('renders base tabs (without salary tab when not allowed)', () => {
    render(
      <PeopleTabsCompact activeTab="analyses" onTabChange={onTabChange} canViewSalaries={false} />
    )
    const buttons = screen.getAllByRole('button')
    // 9 tabs minus 1 salary = 8
    expect(buttons).toHaveLength(8)
  })

  it('renders salary tab when canViewSalaries is true', () => {
    render(
      <PeopleTabsCompact activeTab="analyses" onTabChange={onTabChange} canViewSalaries={true} />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(9)
  })

  it('calls onTabChange on click', () => {
    render(<PeopleTabsCompact activeTab="analyses" onTabChange={onTabChange} />)
    fireEvent.click(screen.getAllByRole('button')[1]) // equipe tab
    expect(onTabChange).toHaveBeenCalledWith('equipe')
  })

  it('highlights active tab', () => {
    const { container } = render(<PeopleTabsCompact activeTab="equipe" onTabChange={onTabChange} />)
    const activeBtn = container.querySelector('.bg-card.text-primary')
    expect(activeBtn).toBeInTheDocument()
  })
})
