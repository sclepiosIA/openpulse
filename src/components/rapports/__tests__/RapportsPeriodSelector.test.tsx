import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RapportsPeriodSelector } from '../RapportsPeriodSelector'

describe('RapportsPeriodSelector', () => {
  const baseProps = {
    periodPreset: '30d' as const,
    onPeriodChange: vi.fn(),
    customStartDate: new Date(2026, 2, 1),
    customEndDate: new Date(2026, 2, 9),
    onCustomStartDateChange: vi.fn(),
    onCustomEndDateChange: vi.fn(),
  }

  it('renders all preset buttons', () => {
    render(<RapportsPeriodSelector {...baseProps} />)
    expect(screen.getByText('7j')).toBeInTheDocument()
    expect(screen.getByText('30j')).toBeInTheDocument()
    expect(screen.getByText('90j')).toBeInTheDocument()
    expect(screen.getByText('1 an')).toBeInTheDocument()
  })

  it('highlights active preset', () => {
    render(<RapportsPeriodSelector {...baseProps} />)
    expect(screen.getByText('30j').className).toContain('bg-card')
  })

  it('calls onPeriodChange when preset clicked', () => {
    const onChange = vi.fn()
    render(<RapportsPeriodSelector {...baseProps} onPeriodChange={onChange} />)
    fireEvent.click(screen.getByText('7j'))
    expect(onChange).toHaveBeenCalledWith('7d')
  })

  it('shows custom date range when custom preset active', () => {
    render(<RapportsPeriodSelector {...baseProps} periodPreset="custom" />)
    expect(screen.getByText(/01\/03.*09\/03/)).toBeInTheDocument()
  })
})
