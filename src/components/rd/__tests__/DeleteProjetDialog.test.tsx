import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeleteProjetDialog } from '../DeleteProjetDialog';

vi.mock('@/hooks/rd/useRD', () => ({
  useDeleteRDProjet: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRDEpics: () => ({ data: [{ id: 'e1' }] }),
  useRDUserStories: () => ({ data: [{ id: 's1' }, { id: 's2' }] }),
  useRDSprints: () => ({ data: [{ id: 'sp1' }] }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const projet = {
  id: 'p1',
  nom: 'Mon Projet',
  description: 'Test',
  statut: 'actif' as const,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  created_by: 'u1',
  date_debut: '2026-01-01',
  date_fin_prevue: '2026-06-01',
  responsable_id: 'u1',
  couleur: '#6366f1',
  dpi: null,
  visible_portail: false,
};

describe('DeleteProjetDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <QueryClientProvider client={qc}>
        <DeleteProjetDialog projet={projet} open={false} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.queryByText('Supprimer le projet')).not.toBeInTheDocument();
  });

  it('renders warning when open', () => {
    render(
      <QueryClientProvider client={qc}>
        <DeleteProjetDialog projet={projet} open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Supprimer le projet')).toBeInTheDocument();
  });

  it('shows project name in warning', () => {
    render(
      <QueryClientProvider client={qc}>
        <DeleteProjetDialog projet={projet} open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/"Mon Projet"/)).toBeInTheDocument();
  });

  it('shows counts of linked items', () => {
    render(
      <QueryClientProvider client={qc}>
        <DeleteProjetDialog projet={projet} open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/1 epic/i)).toBeInTheDocument();
    expect(screen.getByText(/2 user stor/i)).toBeInTheDocument();
    expect(screen.getByText(/1 sprint/i)).toBeInTheDocument();
  });

  it('requires confirmation text to enable delete', () => {
    render(
      <QueryClientProvider client={qc}>
        <DeleteProjetDialog projet={projet} open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    const confirmInput = screen.getByPlaceholderText(/Tapez le nom/);
    expect(confirmInput).toBeInTheDocument();
  });
});
