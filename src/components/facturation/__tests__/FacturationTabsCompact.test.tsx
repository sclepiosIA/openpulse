import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FacturationTabsCompact } from '../FacturationTabsCompact'

describe('FacturationTabsCompact', () => {
  it('renders all 6 tabs', () => {
    const { container } = render(
      <FacturationTabsCompact activeTab="dashboard" onTabChange={vi.fn()} />
    )
    expect(container.querySelectorAll('button').length).toBe(6)
  })

  it('renders active tab with active styling', () => {
    const { container } = render(
      <FacturationTabsCompact activeTab="factures" onTabChange={vi.fn()} />
    )
    const activeBtn = container.querySelector('button.bg-card')
    expect(activeBtn).toBeTruthy()
  })

  it('calls onTabChange when tab clicked', () => {
    const onChange = vi.fn()
    render(<FacturationTabsCompact activeTab="dashboard" onTabChange={onChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[2]) // "Devis" tab
    expect(onChange).toHaveBeenCalledWith('devis')
  })

  it('renders badge when value provided', () => {
    render(
      <FacturationTabsCompact
        activeTab="dashboard"
        onTabChange={vi.fn()}
        badges={{ facturesEnRetard: 5 }}
      />
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders 99+ for large badge values', () => {
    render(
      <FacturationTabsCompact
        activeTab="dashboard"
        onTabChange={vi.fn()}
        badges={{ devisEnAttente: 150 }}
      />
    )
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('does not render badge span when value is 0', () => {
    const { container } = render(
      <FacturationTabsCompact
        activeTab="dashboard"
        onTabChange={vi.fn()}
        badges={{ facturesEnRetard: 0 }}
      />
    )
    // The destructive badge span should not appear
    expect(container.querySelector('.bg-destructive')).toBeNull()
  })
})
