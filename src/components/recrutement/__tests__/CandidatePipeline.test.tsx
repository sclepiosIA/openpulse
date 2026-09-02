import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/recrutement/useCandidates', () => ({
  useCandidates: () => ({ data: [], isLoading: false }),
  useUpdateCandidateStatus: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/recrutement/useJobOffers', () => ({
  useJobOffers: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/types/recrutement', () => ({
  CANDIDATE_PIPELINE_COLUMNS: [
    { key: 'nouveau', label: 'Nouveau' },
    { key: 'entretien', label: 'Entretien' },
    { key: 'offre', label: 'Offre' },
  ],
  CANDIDATE_STATUS_LABELS: {
    nouveau: 'Nouveau',
    entretien: 'Entretien',
    offre: 'Offre',
  },
}));

import CandidatePipeline from '../CandidatePipeline';

describe('CandidatePipeline', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <CandidatePipeline />
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
