import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RDSprintBoard } from '../RDSprintBoard';

vi.mock('@/hooks/rd/useRD', () => ({
  useRDSprints: () => ({
    data: [
      { id: 'sp1', numero: 1, nom: 'Sprint 1', statut: 'actif', date_debut: '2026-03-01', date_fin: '2026-03-14', objectif: 'Test' },
    ],
  }),
  useActiveSprint: () => ({
    data: { id: 'sp1', numero: 1, nom: 'Sprint 1', statut: 'actif', date_debut: '2026-03-01', date_fin: '2026-03-14' },
  }),
  useRDUserStories: () => ({ data: [] }),
  useSprintStats: () => ({ data: { total: 0, done: 0, points_total: 0, points_done: 0 } }),
  useUpdateStoryStatus: () => ({ mutate: vi.fn() }),
  useUpdateRDSprint: () => ({ mutate: vi.fn() }),
  useCreateRDUserStory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRDSprint: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RDSprintBoard', () => {
  it('renders sprint board with active sprint', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDSprintBoard projetId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getAllByText('Sprint 1').length).toBeGreaterThanOrEqual(1);
  });

  it('renders kanban columns', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDSprintBoard projetId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('À faire')).toBeInTheDocument();
  });
});
