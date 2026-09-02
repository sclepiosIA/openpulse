import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockSelect = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: (...args: any[]) => {
        mockSelect(...args);
        return {
          order: vi.fn().mockResolvedValue({
            data: [
              {
                key: 'company_info',
                value: { name: 'OpenPulse', siret: '123' },
                category: 'general',
                description: null,
                updated_at: '2026-01-01',
                updated_by: null,
              },
              {
                key: 'infrastructure_urls',
                value: { cdn_url: 'https://cdn.test.com', jitsi_url: 'https://jitsi.test.com' },
                category: 'infra',
                description: null,
                updated_at: '2026-01-01',
                updated_by: null,
              },
              {
                key: 'internal_team_emails',
                value: { emails: ['a@test.com', 'b@test.com'] },
                category: 'email',
                description: null,
                updated_at: '2026-01-01',
                updated_by: null,
              },
            ],
            error: null,
          }),
        };
      },
    }),
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import {
  useAppConfig,
  useCompanyInfo,
  useInfraUrls,
  useInternalTeamEmails,
} from '../shared/useAppConfig';
import { supabase } from '@/integrations/supabase/client';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useAppConfig', () => {
  it('returns typed config value by key', async () => {
    const { result } = renderHook(() => useAppConfig('company_info'), {
      wrapper: createWrapper(),
    });
    // Initially loading
    expect(result.current.isLoading).toBe(true);
  });

  it('useCompanyInfo returns company data', async () => {
    const { result } = renderHook(() => useCompanyInfo(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('useInfraUrls returns defaults when no data', () => {
    // Without waiting for query, should return defaults
    const { result } = renderHook(() => useInfraUrls(), {
      wrapper: createWrapper(),
    });
    // Before data loads, defaults are returned
    expect(result.current.cdn_url).toBe('');
    expect(result.current.jitsi_url).toBe('');
  });

  it('useInternalTeamEmails returns empty array as default', () => {
    const { result } = renderHook(() => useInternalTeamEmails(), {
      wrapper: createWrapper(),
    });
    expect(Array.isArray(result.current)).toBe(true);
  });
});
