import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TresorerieTabsCompact } from '../TresorerieTabsCompact'

describe('TresorerieTabsCompact', () => {
  it('renders 7 tab buttons', () => {
    const { container } = render(
      <TresorerieTabsCompact activeTab="dashboard" onTabChange={vi.fn()} />
    )
    expect(container.querySelectorAll('button').length).toBe(7)
  })

  it('highlights active tab with bg-card', () => {
    const { container } = render(
      <TresorerieTabsCompact activeTab="revenus" onTabChange={vi.fn()} />
    )
    const buttons = container.querySelectorAll('button')
    const activeBtn = Array.from(buttons).find((b) => b.className.includes('bg-card'))
    expect(activeBtn).toBeDefined()
  })

  it('calls onTabChange when clicked', () => {
    const onChange = vi.fn()
    const { container } = render(
      <TresorerieTabsCompact activeTab="dashboard" onTabChange={onChange} />
    )
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[1]) // revenus
    expect(onChange).toHaveBeenCalledWith('revenus')
  })

  it('shows badge when provided', () => {
    render(
      <TresorerieTabsCompact
        activeTab="dashboard"
        onTabChange={vi.fn()}
        badges={{ depensesRetard: 5 }}
      />
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows 99+ for large badge values', () => {
    render(
      <TresorerieTabsCompact
        activeTab="dashboard"
        onTabChange={vi.fn()}
        badges={{ depensesRetard: 150 }}
      />
    )
    expect(screen.getByText('99+')).toBeInTheDocument()
  })
})
