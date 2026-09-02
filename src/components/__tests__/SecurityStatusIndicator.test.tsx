import { supabase } from "@/integrations/supabase/client";
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/hooks/shared/useUserRole', () => ({
  useUserRole: () => ({ isAdmin: true, isLoading: false }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({
      data: [
        { check_name: 'RLS Check', status: 'OK', details: 'All good', recommendation: '' },
      ],
      error: null,
    }),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn() },
}));

const renderWithQC = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

describe('SecurityStatusIndicator', () => {
  it('should render secured badge when no issues', async () => {
    const { SecurityStatusIndicator } = await import('@/components/auth/SecurityStatusIndicator');
    renderWithQC(<SecurityStatusIndicator />);
    await waitFor(() => {
      expect(screen.getByText('Sécurisé')).toBeInTheDocument();
    });
  });

  it('should render critical badge when critical issues exist', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.rpc as any).mockResolvedValueOnce({
      data: [
        { check_name: 'Check 1', status: 'CRITICAL', details: 'Bad', recommendation: 'Fix' },
        { check_name: 'Check 2', status: 'CRITICAL', details: 'Bad', recommendation: 'Fix' },
      ],
      error: null,
    });
    const { SecurityStatusIndicator } = await import('@/components/auth/SecurityStatusIndicator');
    renderWithQC(<SecurityStatusIndicator />);
    await waitFor(() => {
      expect(screen.getByText(/2 Critiques/)).toBeInTheDocument();
    });
  });

  it('should return null when loading', async () => {
    const { SecurityStatusIndicator } = await import('@/components/auth/SecurityStatusIndicator');
    const { container } = renderWithQC(<SecurityStatusIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('should return null when no user', async () => {
    vi.doMock('@/components/AuthProvider', () => ({
      useAuth: () => ({ user: null }),
    }));
    vi.resetModules();
    try {
      const mod = await import('@/components/auth/SecurityStatusIndicator');
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { container } = render(
        <QueryClientProvider client={qc}><mod.SecurityStatusIndicator /></QueryClientProvider>
      );
      expect(container.firstChild).toBeNull();
    } finally {
      vi.doUnmock('@/components/AuthProvider');
      vi.resetModules();
    }
  });
});
