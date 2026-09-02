import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FacturationDetaillee } from '../FacturationDetaillee';

vi.mock('@/hooks/billing/useFacturationPeriodes', () => ({
  useFacturationPeriodes: () => ({
    periodes: [
      { id: 'p1', date_debut: '2026-01-01', date_fin: '2026-01-31', montant_prevu: 5000, montant_facture: 5000, montant_percu: 5000, statut: 'encaissee', date_facture: '2026-01-15', date_virement_estimee: '2026-02-15', date_echeance: '2026-02-15', notes: null, est_modifie_manuellement: false },
      { id: 'p2', date_debut: '2026-02-01', date_fin: '2026-02-28', montant_prevu: 5000, montant_facture: null, montant_percu: null, statut: 'prevue', date_facture: null, date_virement_estimee: null, date_echeance: null, notes: null, est_modifie_manuellement: false },
    ],
    isLoading: false,
    syncPeriodes: vi.fn(),
    updatePeriode: { mutate: vi.fn() },
    deletePeriode: { mutate: vi.fn() },
    regenererFutures: vi.fn(),
  }),
}));

vi.mock('@/components/tresorerie/EditableCell', () => ({
  EditableCell: ({ value }: any) => <span>{value}</span>,
}));

vi.mock('@/components/csm/EditableDateCell', () => ({
  EditableDateCell: ({ value }: any) => <span>{value || '-'}</span>,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etab = { id: 'e1', nom: 'CHU Test', type_offre: 'Statique' };

describe('FacturationDetaillee', () => {
  it('renders KPI cards', () => {
    render(
      <QueryClientProvider client={qc}>
        <FacturationDetaillee etablissementId="e1" etablissement={etab} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Total annuel prévu')).toBeInTheDocument();
    expect(screen.getByText('Encaissé')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getAllByText('En retard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders filter buttons', () => {
    render(
      <QueryClientProvider client={qc}>
        <FacturationDetaillee etablissementId="e1" etablissement={etab} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Tous')).toBeInTheDocument();
    expect(screen.getByText('Prévues')).toBeInTheDocument();
    expect(screen.getByText('Encaissées')).toBeInTheDocument();
  });

  it('renders year group for 2026', () => {
    render(
      <QueryClientProvider client={qc}>
        <FacturationDetaillee etablissementId="e1" etablissement={etab} />
      </QueryClientProvider>
    );
    expect(screen.getByText('2026')).toBeInTheDocument();
  });
});
