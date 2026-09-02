import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({
    data: [
      { id: 'e1', statut: 'Prospect', nom: 'Etab 1', montant_estime: 10000 },
      { id: 'e2', statut: 'Prospect', nom: 'Etab 2', montant_estime: 20000 },
      { id: 'e3', statut: 'Contractualisation', nom: 'Etab 3', montant_estime: 50000 },
      { id: 'e4', statut: 'Production', nom: 'Etab 4', montant_estime: 100000 },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: (e: any) => e.montant_estime || 0,
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/pipeline/StageCard', () => ({
  StageCard: ({ stage, onClick }: any) =>
    React.createElement('div', { onClick, 'data-testid': `stage-${stage.name}` },
      React.createElement('span', null, stage.name),
      React.createElement('span', null, `${stage.count}`)
    ),
}));

describe('PipelineVisualization', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  const renderPipeline = async () => {
    const { PipelineVisualization } = await import('@/components/pipeline/PipelineVisualization');
    return render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(MemoryRouter, null,
          React.createElement(PipelineVisualization)
        )
      )
    );
  };

  it('should render pipeline title', async () => {
    await renderPipeline();
    expect(screen.getByText('Pipeline Commercial Global')).toBeInTheDocument();
  });

  it('should show total count', async () => {
    await renderPipeline();
    expect(screen.getByText(/4 établissements/)).toBeInTheDocument();
  });

  it('should render phase indicators', async () => {
    await renderPipeline();
    expect(screen.getByText('Début de cycle')).toBeInTheDocument();
    expect(screen.getByText('Phase active')).toBeInTheDocument();
    expect(screen.getByText('Phase finale')).toBeInTheDocument();
  });

  it('should show stages with data', async () => {
    await renderPipeline();
    expect(screen.getByTestId('stage-Prospect')).toBeInTheDocument();
    expect(screen.getByTestId('stage-Production')).toBeInTheDocument();
  });
});
