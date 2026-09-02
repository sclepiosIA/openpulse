import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TabsCompact } from '../TabsCompact'

describe('TabsCompact (Analyse)', () => {
  it('renders 4 tab buttons', () => {
    const { container } = render(<TabsCompact value="map" onValueChange={vi.fn()} />)
    expect(container.querySelectorAll('button').length).toBe(4)
  })

  it('calls onValueChange when clicked', () => {
    const onChange = vi.fn()
    const { container } = render(<TabsCompact value="map" onValueChange={onChange} />)
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[2]) // table
    expect(onChange).toHaveBeenCalledWith('table')
  })

  it('highlights active tab', () => {
    const { container } = render(<TabsCompact value="charts" onValueChange={vi.fn()} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons[1].className).toContain('bg-card')
  })
})
