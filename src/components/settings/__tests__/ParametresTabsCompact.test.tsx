import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ParametresTabsCompact } from '../ParametresTabsCompact'

describe('ParametresTabsCompact', () => {
  it('renders general tab for non-admin', () => {
    render(<ParametresTabsCompact activeTab="general" onTabChange={vi.fn()} isAdmin={false} />)
    expect(screen.getByText('Général')).toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('renders both tabs for admin', () => {
    render(<ParametresTabsCompact activeTab="general" onTabChange={vi.fn()} isAdmin={true} />)
    expect(screen.getByText('Général')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('calls onTabChange when tab clicked', () => {
    const onChange = vi.fn()
    render(<ParametresTabsCompact activeTab="general" onTabChange={onChange} isAdmin={true} />)
    fireEvent.click(screen.getByText('Admin'))
    expect(onChange).toHaveBeenCalledWith('admin')
  })

  it('highlights active tab', () => {
    render(<ParametresTabsCompact activeTab="general" onTabChange={vi.fn()} isAdmin={true} />)
    expect(screen.getByText('Général').closest('button')?.className).toContain('bg-card')
  })
})
