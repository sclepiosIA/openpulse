import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockJalons = [
  { id: 'j1', etablissement_id: 'e1', jalon_type: 'onboarding', statut: 'termine', date_jalon: '2025-01-01', notes: '', created_at: '', updated_at: '' },
];

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: () => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: mockJalons, error: null }),
        }),
      }),
      order: () => ({
        limit: () => Promise.resolve({ data: mockJalons, error: null }),
      }),
    }),
    upsert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: mockJalons[0], error: null }),
      }),
    }),
    delete: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }),
}));

import { useCsmParcours } from '../csm/useCsmParcours';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useCsmParcours', () => {
  it('returns parcours data', async () => {
    const { result } = renderHook(() => useCsmParcours('e1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].jalon_type).toBe('onboarding');
  });

  it('exposes upsert and remove methods', () => {
    const { result } = renderHook(() => useCsmParcours(), { wrapper });
    expect(typeof result.current.upsert).toBe('function');
    expect(typeof result.current.remove).toBe('function');
  });
});
