import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CalendarHeaderActions } from '../CalendarHeaderActions'

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/hooks/calendar/useCalendarKeyboard', () => ({
  CALENDAR_SHORTCUTS: [],
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

vi.mock('@/hooks/calendar/useCalendars', () => ({
  useCalendars: () => ({ data: [], isLoading: false }),
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('CalendarHeaderActions', () => {
  const defaultProps = {
    onCreateEvent: vi.fn(),
    onCreateTask: vi.fn(),
    onOpenSync: vi.fn(),
    onExport: vi.fn(),
    onToggleFilters: vi.fn(),
    showFilters: false,
    hasActiveFilters: false,
    filteredTasks: [],
    onTaskClick: vi.fn(),
    selectedCalendarIds: [],
    onCalendarToggle: vi.fn(),
    onSelectAllCalendars: vi.fn(),
    onDeselectAllCalendars: vi.fn(),
  }

  it('renders action buttons', () => {
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <CalendarHeaderActions {...defaultProps} />
        </TooltipProvider>
      </QueryClientProvider>
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })
})
