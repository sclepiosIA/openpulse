import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarDayView } from '../CalendarDayView'
import type { Task } from '@/types/gantt'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

vi.mock('@/hooks/tasks/useCreateTache', () => ({
  useCreateTache: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: () => ({ data: [] }),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useActiveProfiles: () => ({ data: [] }),
}))

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: () => ({ data: [] }),
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}))

const tasks: Task[] = [
  {
    id: 't1',
    titre: 'Tâche A',
    echeance: '2026-03-10',
    statut: 'En cours',
    priorite: 'high',
    created_at: '2026-03-01',
    updated_at: '2026-03-01',
  },
]

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )

describe('CalendarDayView', () => {
  it('renders date selector card', () => {
    wrap(
      <CalendarDayView
        tasks={tasks}
        selectedDate={new Date(2026, 2, 10)}
        onDateChange={vi.fn()}
        onTaskClick={vi.fn()}
        datesWithTasks={[new Date(2026, 2, 10)]}
      />
    )
    expect(screen.getByText('Sélectionner une date')).toBeInTheDocument()
  })

  it('renders task for selected date', () => {
    wrap(
      <CalendarDayView
        tasks={tasks}
        selectedDate={new Date(2026, 2, 10)}
        onDateChange={vi.fn()}
        onTaskClick={vi.fn()}
        datesWithTasks={[new Date(2026, 2, 10)]}
      />
    )
    expect(screen.getByText('Tâche A')).toBeInTheDocument()
  })
})
