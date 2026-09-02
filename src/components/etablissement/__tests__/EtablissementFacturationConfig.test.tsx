import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => {
  const p: any = new Proxy({}, { get: () => (..._a: any[]) => p });
  return { supabase: p };
});

vi.mock('@/hooks/billing/useFacturationEtablissement', () => ({
  useEtablissementModeleEconomique: () => ({ data: null, isLoading: false }),
  calculateMontantAnnuel: (etab: any) => ({ montant: 0, modele: 'Non défini' }),
  calculateMontantPeriodique: (montant: number, _p: string) => montant / 12,
}));

vi.mock('@/hooks/crm/useEtablissementGroupeFacturation', () => ({
  useEtablissementGroupeFacturation: () => ({ data: null, isLoading: false }),
  useSaveGroupeFacturation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/crm/useEtablissements', () => ({
  etablissementKeys: { all: ['etablissements'] },
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (n: number) => `${n} €`,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { EtablissementFacturationConfig } from '../EtablissementFacturationConfig';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etablissement = {
  id: 'e1',
  nom: 'CHU Test',
  client_facturation: 'etablissement',
  type_offre: 'Statique',
  periodicite_paiement: 'mensuel',
  pallier_vise: '50000',
};

describe('EtablissementFacturationConfig', () => {
  it('renders facturation config', () => {
    render(
      <QueryClientProvider client={qc}>
        <EtablissementFacturationConfig etablissementId="e1" etablissement={etablissement as any} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Modèle économique')).toBeInTheDocument();
  });
});
