import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useProfilesWithRoles: () => ({
    data: [
      {
        id: 'p1', nom: 'Dupont', prenom: 'Jean', email: 'jean@test.com',
        fonction: 'Dev', role: 'csm', actif: true, type_contrat: 'cdi',
        date_embauche: '2024-01-01', avatar_url: null, telephone: null,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/hr/useRHSalaires', () => ({
  useRHSalaires: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/hr/useRHAbsences', () => ({
  useRHAbsences: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/hr/useRHDocuments', () => ({
  useRHDocuments: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useDeleteProfile: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('./SalairesHistoryChart', () => ({ SalairesHistoryChart: () => null }));
vi.mock('./UploadDocumentDialog', () => ({ UploadDocumentDialog: () => null }));
vi.mock('./EditEmployeeDialog', () => ({ EditEmployeeDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

import { RHFicheEmploye } from '../RHFicheEmploye';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RHFicheEmploye', () => {
  it('renders employee selector', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHFicheEmploye />
      </QueryClientProvider>
    );
    expect(screen.getByText('Sélectionner un employé')).toBeInTheDocument();
  });

  it('renders select placeholder', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHFicheEmploye />
      </QueryClientProvider>
    );
    expect(screen.getByText('Sélectionner un employé...')).toBeInTheDocument();
  });
});
