import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CalendarMiniCalendar } from '../CalendarMiniCalendar'

// Utilise la date courante pour que react-day-picker affiche bien ce mois
const NOW = new Date()
const MONTH_RE = new RegExp(NOW.toLocaleString('fr-FR', { month: 'long' }), 'i')

describe('CalendarMiniCalendar', () => {
  it('renders calendar component', () => {
    const { container } = render(<CalendarMiniCalendar selected={NOW} onSelect={vi.fn()} />)
    // react-day-picker renders a table
    expect(container.querySelector('table')).toBeTruthy()
  })

  it('renders with custom className', () => {
    const { container } = render(
      <CalendarMiniCalendar selected={NOW} onSelect={vi.fn()} className="custom" />
    )
    expect(container.querySelector('.custom')).toBeTruthy()
  })

  it('renders month name', () => {
    const { container } = render(<CalendarMiniCalendar selected={NOW} onSelect={vi.fn()} />)
    // react-day-picker rend la légende avec aria-live="polite" et role="presentation"
    const caption = container.querySelector('[aria-live="polite"]')
    expect(caption?.textContent?.toLowerCase()).toMatch(MONTH_RE)
  })
})
