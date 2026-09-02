import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StoryDetailDialog } from '../StoryDetailDialog'
import { supabase } from '@/integrations/supabase/client';

const { EPICS } = vi.hoisted(() => ({
  EPICS: [{ id: 'e1', titre: 'Epic 1', couleur: '#6366f1' }],
}))

vi.mock('@/hooks/rd/useRD', () => ({
  useUpdateRDUserStory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRDTasks: () => ({ data: [], refetch: vi.fn() }),
  useCreateRDTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRDTask: () => ({ mutateAsync: vi.fn() }),
  useDeleteRDTask: () => ({ mutateAsync: vi.fn() }),
  useRDEpics: () => ({ data: EPICS }),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [{ id: 'u1', nom: 'Dupont', prenom: 'Jean' }] }),
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

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const mockStory = {
  id: 's1',
  titre: 'User Story Test',
  description: 'Description de test',
  points: 5 as const,
  priorite: 'high' as const,
  statut: 'todo' as const,
  epic_id: 'e1',
  responsable_id: null,
  date_debut: null,
  date_fin: null,
  criteres_acceptation: ['Critère 1'],
  sprint_id: null,
  projet_id: 'p1',
  ordre: 0,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

describe('StoryDetailDialog', () => {
  it('renders story title when open', () => {
    render(
      <QueryClientProvider client={qc}>
        <StoryDetailDialog story={mockStory} projetId="p1" open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    expect(screen.getByDisplayValue('User Story Test')).toBeInTheDocument()
  })

  it('renders priority selector', () => {
    render(
      <QueryClientProvider client={qc}>
        <StoryDetailDialog story={mockStory} projetId="p1" open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    expect(screen.getByText('Priorité')).toBeInTheDocument()
  })

  it('renders acceptance criteria after clicking Critères tab', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={qc}>
        <StoryDetailDialog story={mockStory} projetId="p1" open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    await user.click(screen.getByRole('tab', { name: 'Critères' }))
    expect(screen.getByText('Critère 1')).toBeInTheDocument()
  })
})
