import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RHDemandeConge } from '../RHDemandeConge';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@test.com' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            lte: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: {}, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RHDemandeConge', () => {
  it('renders form title', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHDemandeConge />
      </QueryClientProvider>
    );
    expect(screen.getByText('Nouvelle demande de congé')).toBeInTheDocument();
  });

  it('renders type selector', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHDemandeConge />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Type d'absence/)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHDemandeConge />
      </QueryClientProvider>
    );
    expect(screen.getByRole('button', { name: /Soumettre/i })).toBeInTheDocument();
  });
});
