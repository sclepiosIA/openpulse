import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/auth/useAuthorizedIPs', () => ({
  useAuthorizedIPs: () => ({ data: [], isLoading: false, error: null }),
  useAddAuthorizedIP: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAuthorizedIP: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

import { AuthorizedIPsManager } from '../AuthorizedIPsManager';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('AuthorizedIPsManager', () => {
  it('renders title', () => {
    render(
      <QueryClientProvider client={qc}>
        <AuthorizedIPsManager ipWhitelistEnabled={false} onToggleIpWhitelist={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Gestion des IP Autorisées')).toBeInTheDocument();
  });

  it('renders toggle switch', () => {
    render(
      <QueryClientProvider client={qc}>
        <AuthorizedIPsManager ipWhitelistEnabled={true} onToggleIpWhitelist={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });
});
