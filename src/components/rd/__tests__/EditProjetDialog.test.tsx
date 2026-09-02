import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditProjetDialog } from '../EditProjetDialog';

vi.mock('@/hooks/rd/useRD', () => ({
  useUpdateRDProjet: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [] }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const projet = {
  id: 'p1',
  nom: 'Projet Alpha',
  description: 'Description test',
  statut: 'actif' as const,
  couleur: '#3b82f6',
  date_debut: '2025-01-01',
  date_fin_prevue: '2025-12-31',
  responsable_id: null,
  dpi: null,
  visible_portail: false,
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
} as any;

describe('EditProjetDialog', () => {
  it('renders dialog with project name', () => {
    render(
      <QueryClientProvider client={qc}>
        <EditProjetDialog projet={projet} open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByDisplayValue('Projet Alpha')).toBeInTheDocument();
  });

  it('renders statut selector', () => {
    render(
      <QueryClientProvider client={qc}>
        <EditProjetDialog projet={projet} open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Statut')).toBeInTheDocument();
  });

  it('renders description field', () => {
    render(
      <QueryClientProvider client={qc}>
        <EditProjetDialog projet={projet} open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByDisplayValue('Description test')).toBeInTheDocument();
  });

  it('renders save and cancel buttons', () => {
    render(
      <QueryClientProvider client={qc}>
        <EditProjetDialog projet={projet} open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Enregistrer')).toBeInTheDocument();
    expect(screen.getByText('Annuler')).toBeInTheDocument();
  });
});
