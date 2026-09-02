import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/tresorerie/calculateRevenues', () => ({
  calculateTotalPaymentForMonth: () => 5000,
}));

import { useFacturationPeriodes } from '../billing/useFacturationPeriodes';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: qc }, children);

const mockEtablissement = {
  id: 'e1',
  date_go_live: '2025-01-01',
  periodicite_paiement: 'mensuel',
  montant_mensuel: 5000,
} as any;

describe('useFacturationPeriodes', () => {
  it('returns periodes data', async () => {
    const { result } = renderHook(
      () => useFacturationPeriodes('e1', mockEtablissement),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.periodes).toBeDefined();
  });

  it('provides mutation functions', () => {
    const { result } = renderHook(
      () => useFacturationPeriodes('e1', mockEtablissement),
      { wrapper }
    );
    expect(result.current.updatePeriode).toBeDefined();
    expect(result.current.syncPeriodes).toBeDefined();
  });
});
