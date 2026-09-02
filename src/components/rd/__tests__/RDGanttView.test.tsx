import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RDGanttView } from '../RDGanttView';

vi.mock('@/hooks/rd/useRD', () => ({
  useRDSprints: () => ({
    data: [
      { id: 'sp1', numero: 1, nom: 'Sprint 1', statut: 'actif', date_debut: '2026-03-01', date_fin: '2026-03-14' },
    ],
  }),
  useRDEpics: () => ({ data: [{ id: 'e1', titre: 'Epic 1', couleur: '#3b82f6' }] }),
  useRDUserStories: () => ({ data: [] }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RDGanttView', () => {
  it('renders gantt chart title', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDGanttView projetId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Roadmap & Planning')).toBeInTheDocument();
  });

  it('renders sprint row', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDGanttView projetId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
  });
});
