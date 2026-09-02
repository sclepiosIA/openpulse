import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

import { useOAuthConnections } from '../auth/useOAuthConnections';
import { supabase } from '@/integrations/supabase/client';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useOAuthConnections', () => {
  it('returns static connection map with google/nextcloud connected', async () => {
    const { result } = renderHook(() => useOAuthConnections(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.google.connected).toBe(true);
    expect(result.current.data?.google.shared).toBe(true);
    expect(result.current.data?.nextcloud.connected).toBe(true);
    expect(result.current.data?.microsoft.connected).toBe(false);
    expect(result.current.data?.zoom.connected).toBe(false);
  });
});
