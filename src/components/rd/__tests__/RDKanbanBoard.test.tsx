import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RDKanbanBoard } from '../RDKanbanBoard'
import { supabase } from '@/integrations/supabase/client';

const { STORIES } = vi.hoisted(() => ({
  STORIES: [
    {
      id: 's1',
      titre: 'Story A',
      points: 3,
      priorite: 'high',
      statut: 'todo',
      epic_id: null,
      responsable_id: null,
      date_debut: null,
      date_fin: null,
      sprint_id: null,
      projet_id: 'p1',
      ordre: 0,
      criteres_acceptation: [],
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ],
}))

vi.mock('@/hooks/rd/useRD', () => ({
  useRDUserStories: () => ({ data: STORIES }),
  useRDEpics: () => ({ data: [] }),
  useUpdateStoryStatus: () => ({ mutate: vi.fn() }),
  useUpdateRDUserStory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRDUserStory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRDTasks: () => ({ data: [], refetch: vi.fn() }),
  useCreateRDTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRDTask: () => ({ mutateAsync: vi.fn() }),
  useDeleteRDTask: () => ({ mutateAsync: vi.fn() }),
  useRDEpic: () => ({ data: null }),
}))

vi.mock('@/hooks/rd/useClientEtablissementsForRD', () => ({
  useClientEtablissementsForRD: () => ({ data: [] }),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [] }),
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('RDKanbanBoard', () => {
  it('renders kanban columns', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDKanbanBoard projetId="p1" />
      </QueryClientProvider>
    )
    expect(screen.getByText('Backlog')).toBeInTheDocument()
    expect(screen.getByText('À faire')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDKanbanBoard projetId="p1" />
      </QueryClientProvider>
    )
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument()
  })
})
