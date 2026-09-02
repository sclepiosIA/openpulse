import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RDBacklog } from '../RDBacklog';

vi.mock('@/hooks/rd/useRD', () => ({
  useRDEpics: () => ({ data: [{ id: 'e1', titre: 'Epic 1', couleur: '#3b82f6' }] }),
  useBacklog: () => ({
    data: [
      { id: 's1', titre: 'Story 1', points: 3, priorite: 'medium', statut: 'backlog', epic_id: 'e1' },
      { id: 's2', titre: 'Story 2', points: 5, priorite: 'high', statut: 'backlog', epic_id: null },
    ],
  }),
  useRDSprints: () => ({ data: [] }),
  useMoveStoryToSprint: () => ({ mutate: vi.fn() }),
  useCreateRDEpic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRDUserStory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RDBacklog', () => {
  it('renders search input', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDBacklog projetId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument();
  });

  it('renders epic section', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDBacklog projetId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Epic 1')).toBeInTheDocument();
  });

  it('renders total points count', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDBacklog projetId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/8/)).toBeInTheDocument();
  });
});
