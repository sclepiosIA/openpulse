import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockMutation = { mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false };

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/hooks/system/useSystemConfig', () => ({
  useSystemConfig: () => ({ data: null, isLoading: false, error: null }),
  useSystemStats: () => ({ data: null, isLoading: false }),
  useUpdateSystemConfig: () => mockMutation,
  useSystemMaintenanceActions: () =>
    new Proxy({}, { get: () => mockMutation }),
  SystemConfig: {},
}));
vi.mock('@/components/shared/ResponsiveTabs', () => ({
  ResponsiveTabs: ({ children }: any) => <div>{children}</div>,
}));

import ConfigurationSysteme from '../ConfigurationSysteme';

describe('ConfigurationSysteme page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ConfigurationSysteme />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
