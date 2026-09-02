import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnifiedPipeline } from '../UnifiedPipeline';

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({
    data: [
      { id: '1', nom: 'CHU Test', statut: 'Prospect', ca_potentiel: 50000 },
      { id: '2', nom: 'Clinique A', statut: 'Production', ca_potentiel: 120000 },
      { id: '3', nom: 'Hôpital B', statut: 'Contractualisation', ca_potentiel: 80000 },
    ],
  }),
}));

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: (e: any) => e.ca_potentiel || 0,
}));

vi.mock('@/components/pipeline/StageCard', () => ({
  StageCard: ({ label }: any) => <div>{label}</div>,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('UnifiedPipeline', () => {
  const renderPipeline = () =>
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <UnifiedPipeline />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders phase labels', () => {
    renderPipeline();
    expect(screen.getAllByText('Prospection').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Négociation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Contractuel').length).toBeGreaterThanOrEqual(1);
  });

  it('renders pipeline container', () => {
    const { container } = renderPipeline();
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders count badges', () => {
    renderPipeline();
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });
});
