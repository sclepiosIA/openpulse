import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => {
  const p: any = new Proxy({}, { get: () => (..._a: any[]) => p });
  return { supabase: p };
});

vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useProfilesWithRoles: () => ({
    data: [{ id: 'u1', prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com', role: 'user' }],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/hr/useRHSalaires', () => ({
  useRHSalaires: () => ({ salaires: [], isLoading: false }),
}));

vi.mock('@/hooks/hr/useRHAbsences', () => ({
  useRHAbsences: () => ({ absences: [], isLoading: false }),
}));

vi.mock('@/hooks/hr/useRHDocuments', () => ({
  useRHDocuments: () => ({ documents: [], isLoading: false, uploadDocument: vi.fn(), deleteDocument: vi.fn(), getDocumentUrl: vi.fn() }),
}));

vi.mock('@/hooks/tasks/useOnboardingOffboarding', () => ({
  useOnboardingByProfile: () => ({ data: null, isLoading: false }),
  useUpsertOnboarding: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useDeleteProfile: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { RHDossierEmploye } from '../RHDossierEmploye';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RHDossierEmploye', () => {
  it('renders employee selector', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHDossierEmploye />
      </QueryClientProvider>
    );
    // Should show the profile selector with at least one profile
    expect(screen.getAllByText(/Jean Dupont|Sélectionner|Collaborateur/i).length).toBeGreaterThan(0);
  });
});
