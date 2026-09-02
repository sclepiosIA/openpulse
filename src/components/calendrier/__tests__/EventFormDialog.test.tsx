import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/integrations/supabase/client', () => {
  type Chainable = { [K: string]: (...args: unknown[]) => Chainable }
  const p: Chainable = new Proxy({} as Chainable, {
    get:
      () =>
      (..._a: unknown[]) =>
        p,
  })
  return { supabase: p }
})

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// IMPORTANT : ces mocks doivent renvoyer des références STABLES pour `data`.
// EventFormDialog a des useEffect dont les dépendances sont `calendars`,
// `eventReminders`, `eventAttendees` et qui appellent setState. Si le mock
// recrée le tableau `data` à chaque rendu, la dépendance change en permanence
// → l'effet se relance → setState → re-render → BOUCLE INFINIE (hang CPU).
// En production react-query renvoie une référence stable : pas de boucle.
// via vi.hoisted car les factories vi.mock sont hoistées au-dessus des const.
const { STABLE_CALENDARS, STABLE_EMPTY } = vi.hoisted(() => ({
  STABLE_CALENDARS: [
    { id: 'c1', name: 'Principal', color: '#3b82f6', type: 'personal', is_default: true },
  ],
  STABLE_EMPTY: [] as never[],
}))

vi.mock('@/hooks/calendar/useCalendars', () => ({
  useCalendars: () => ({ data: STABLE_CALENDARS }),
  useDefaultCalendar: () => ({ data: STABLE_CALENDARS[0] }),
}))

vi.mock('../CategorySelector', () => ({
  CategorySelector: () => null,
}))

vi.mock('@/hooks/calendar/useCalendarEvents', () => ({
  useCreateEvent: () => ({ mutateAsync: vi.fn() }),
  useUpdateEvent: () => ({ mutateAsync: vi.fn() }),
  useDeleteEvent: () => ({ mutateAsync: vi.fn() }),
  useDeleteOccurrence: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock('@/hooks/calendar/useEventReminders', () => ({
  useAddMultipleReminders: () => ({ mutateAsync: vi.fn() }),
  useRemoveReminder: () => ({ mutateAsync: vi.fn() }),
  useEventReminders: () => ({ data: STABLE_EMPTY }),
}))

vi.mock('@/hooks/calendar/useEventAttendees', () => ({
  useAddMultipleAttendees: () => ({ mutateAsync: vi.fn() }),
  useEventAttendees: () => ({ data: STABLE_EMPTY }),
  useRemoveAttendee: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock('@/lib/recurrenceUtils', () => ({
  isOccurrenceId: () => false,
  parseOccurrenceId: () => ({}),
}))

import { EventFormDialog } from '../EventFormDialog'
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('EventFormDialog', () => {
  it('renders dialog when open', () => {
    render(
      <QueryClientProvider client={qc}>
        <EventFormDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    // Radix Dialog peut rendre le titre en double (visible + a11y) : on cible
    // explicitement le titre (heading) plutôt que n'importe quel nœud texte.
    expect(screen.getByRole('heading', { name: /Nouvel événement/i })).toBeInTheDocument()
  })

  it('does not render dialog when closed', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <EventFormDialog open={false} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
