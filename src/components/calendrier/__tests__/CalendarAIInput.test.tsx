import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/hooks/calendar/useCalendarEvents', () => ({
  useCreateEvent: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/lib/recurrenceUtils', () => ({
  formatRecurrenceRule: () => '',
}))

import { CalendarAIInput } from '../CalendarAIInput'
import { supabase } from '@/integrations/supabase/client'

const calendars = [{ id: 'c1', name: 'Principal', color: '#3b82f6' }]

describe('CalendarAIInput', () => {
  it('renders textarea for AI input', () => {
    const { container } = render(
      <CalendarAIInput calendars={calendars} onEventsCreated={vi.fn()} />
    )
    const textarea = container.querySelector('textarea')
    expect(textarea).toBeInTheDocument()
  })

  it('renders generate button with sparkles icon', () => {
    const { container } = render(
      <CalendarAIInput calendars={calendars} onEventsCreated={vi.fn()} />
    )
    expect(container.querySelector('.lucide-sparkles')).toBeInTheDocument()
  })
})
