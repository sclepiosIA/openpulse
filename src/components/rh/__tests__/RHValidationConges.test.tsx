import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPending = { current: [] as any[] };

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'Error',
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mockPending.current, error: null }),
        }),
      }),
    }),
  },
}));

import { RHValidationConges } from '../RHValidationConges';

const renderCmp = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RHValidationConges />
    </QueryClientProvider>
  );
};

describe('RHValidationConges', () => {
  it('renders empty state when no pending absences', async () => {
    mockPending.current = [];
    renderCmp();
    expect(
      await screen.findByText('Aucune demande en attente de validation')
    ).toBeInTheDocument();
    expect(screen.getByText('Demandes en attente')).toBeInTheDocument();
  });

  it('renders pending absence count badge + collaborator name', async () => {
    mockPending.current = [
      {
        id: 'a1',
        profile_id: 'p1',
        type_absence: 'conge_paye',
        date_debut: '2026-07-01',
        date_fin: '2026-07-10',
        nb_jours: 8,
        demandeur_commentaire: null,
        statut: 'en_attente',
        created_at: '2026-06-01T00:00:00Z',
        profiles: { prenom: 'Alice', nom: 'Martin', email: 'a@x.io' },
      },
      {
        id: 'a2',
        profile_id: 'p2',
        type_absence: 'rtt',
        date_debut: '2026-07-15',
        date_fin: '2026-07-15',
        nb_jours: 1,
        demandeur_commentaire: null,
        statut: 'en_attente',
        created_at: '2026-06-02T00:00:00Z',
        profiles: { prenom: 'Bob', nom: 'Durand', email: 'b@x.io' },
      },
    ];
    renderCmp();
    await waitFor(() => {
      expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    });
    expect(screen.getByText('Bob Durand')).toBeInTheDocument();
    // Badge with count
    expect(screen.getByText('2')).toBeInTheDocument();
    // Type labels mapped
    expect(screen.getByText('Congé payé')).toBeInTheDocument();
    expect(screen.getByText('RTT')).toBeInTheDocument();
  });
});
