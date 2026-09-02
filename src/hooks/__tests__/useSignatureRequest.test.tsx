import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      signature_requests: { data: null, error: { message: 'RLS deny' } },
    },
  }),
);
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { useSignatureRequest } from '../contracts/useSignatureRequest';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useSignatureRequest (error paths)', () => {
  it('does not fire when contratId is undefined', () => {
    const { result } = renderHook(() => useSignatureRequest(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('propagates RLS error from signature_requests select', async () => {
    const { result } = renderHook(() => useSignatureRequest('contrat-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { message?: string })?.message).toMatch(/RLS deny/);
  });
});
