import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      rh_demandes_formation: { data: null, error: { message: 'RLS: rh_demandes_formation forbidden' } },
      rh_objectifs: { data: null, error: { message: 'RLS: rh_objectifs forbidden' } },
    },
  }),
);

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const { toastErrorSpy } = vi.hoisted(() => ({
  toastErrorSpy: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastErrorSpy, success: vi.fn() },
}));

import { useCreateDemandeFormation, useCreateObjectif } from '../hr/useRHMutations';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useRHMutations (error paths)', () => {
  it('useCreateDemandeFormation — toast.error sur RLS deny', async () => {
    toastErrorSpy.mockClear();
    const { result } = renderHook(() => useCreateDemandeFormation(), { wrapper });
    await act(async () => {
      result.current.mutate({
        titre: 'Formation X',
        description: 'desc',
        type: 'externe',
        organisme: 'org',
        cout_estime: '500',
        lien_formation: '',
        date_souhaitee: '2026-09-01',
      });
    });
    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalled());
  });

  it('useCreateObjectif — toast.error sur RLS deny', async () => {
    toastErrorSpy.mockClear();
    const { result } = renderHook(() => useCreateObjectif(), { wrapper });
    await act(async () => {
      result.current.mutate({
        titre: 'Objectif Q3',
        description: 'desc',
        categorie: 'performance',
        priorite: 'haute',
        echeance: '2026-09-30',
      } as any);
    });
    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalled());
  });
});
