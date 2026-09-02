import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockData = [
  {
    id: 'ob1', profile_id: 'p1', statut: 'actif',
    date_entree: '2024-01-01', date_sortie: null,
    dossier_rh: {}, comptes_acces: {}, materiel: {},
    profiles: { prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com', fonction: null },
  },
];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: mockData, error: null }),
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: mockData[0], error: null }),
        }),
      }),
      upsert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: mockData[0], error: null }),
        }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  },
}));

import { useOnboardingOffboarding, useOnboardingByProfile } from '../tasks/useOnboardingOffboarding';
import { supabase } from '@/integrations/supabase/client';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useOnboardingOffboarding', () => {
  it('returns fiches list', async () => {
    const { result } = renderHook(() => useOnboardingOffboarding(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe('useOnboardingByProfile', () => {
  it('returns fiche for profile', async () => {
    const { result } = renderHook(() => useOnboardingByProfile('p1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.statut).toBe('actif');
  });
});
