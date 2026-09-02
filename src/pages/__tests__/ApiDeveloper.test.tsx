import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/hooks/shared/useApi', () => ({
  useApiStats: () => ({ data: { totalRequests: 0, avgResponseTime: 0, errorRate: 0, activeKeys: 0 }, isLoading: false }),
  useApiKeys: () => ({ data: [], isLoading: false }),
  useApiLogs: () => ({ data: [], isLoading: false }),
  useApiEndpoints: () => ({ data: [], isLoading: false }),
  useWebhooks: () => ({ data: [], isLoading: false }),
  useCreateApiKey: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeApiKey: () => ({ mutateAsync: vi.fn() }),
  useCreateWebhook: () => ({ mutateAsync: vi.fn() }),
  useDeleteWebhook: () => ({ mutateAsync: vi.fn() }),
  useMarketplaceConnectors: () => ({ data: [], isLoading: false }),
  useMyConnectorInstallations: () => ({ data: [], isLoading: false }),
  useInstallConnector: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import ApiDeveloper from '../ApiDeveloper';

describe('ApiDeveloper page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <ApiDeveloper />
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
