import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the full supabase chain: .from().select().order().limit()
const mockLimit = vi.fn();
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockInsert = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));


// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    })),
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { useTresorerieRevenus, Revenu } from '@/hooks/tresorerie/useTresorerieRevenus';
import { supabase } from '@/integrations/supabase/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockRevenus: Revenu[] = [
  {
    id: 'rev-1',
    etablissement_id: 'etab-1',
    mois: '2026-01',
    montant_prevu: 5000,
    montant_paye: null,
    statut: 'contractualise',
    type_revenu: 'abonnement',
    date_facture: null,
    date_paiement_reel: null,
    numero_facture: null,
    notes: null,
    source_modele: null,
    date_prevue: null,
    categorie_code: null,
    etablissements: { id: 'etab-1', nom: 'CHU Paris' },
  },
  {
    id: 'rev-2',
    etablissement_id: 'etab-2',
    mois: '2026-01',
    montant_prevu: 3500,
    montant_paye: 3500,
    statut: 'paye',
    type_revenu: 'abonnement',
    date_facture: '2026-01-05',
    date_paiement_reel: '2026-01-15',
    numero_facture: 'FAC-2026-001',
    notes: null,
    source_modele: 'qonto',
    date_prevue: null,
    categorie_code: null,
    etablissements: { id: 'etab-2', nom: 'Clinique Lyon' },
  },
];

describe('useTresorerieRevenus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  describe('Query', () => {
    it('should return hook structure with initial state', () => {
      const { result } = renderHook(() => useTresorerieRevenus(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toHaveProperty('revenus');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('createRevenu');
      expect(result.current).toHaveProperty('marquerFacture');
      expect(result.current).toHaveProperty('marquerPaye');
      expect(result.current).toHaveProperty('updateRevenu');
    });

    it('should fetch revenus from tresorerie_revenus table', async () => {
      mockLimit.mockResolvedValue({ data: mockRevenus, error: null });

      const { result } = renderHook(() => useTresorerieRevenus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.revenus).toHaveLength(2);
      expect(result.current.revenus[0].etablissements?.nom).toBe('CHU Paris');
    });

    it('should handle fetch error gracefully', async () => {
      const fetchError = new Error('Erreur de récupération des revenus');
      mockLimit.mockResolvedValue({ data: null, error: fetchError });

      const { result } = renderHook(() => useTresorerieRevenus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.revenus).toEqual([]);
      expect(supabase.from).toHaveBeenCalledWith('tresorerie_revenus');
      expect(mockOrder).toHaveBeenCalledWith('mois', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(500);
    });
  });

  describe('Mutations', () => {
    it('should provide createRevenu mutation', () => {
      const { result } = renderHook(() => useTresorerieRevenus(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.createRevenu).toBe('function');
      expect(result.current.isCreating).toBe(false);
    });

    it('should provide marquerFacture helper', () => {
      const { result } = renderHook(() => useTresorerieRevenus(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.marquerFacture).toBe('function');
    });

    it('should provide marquerPaye helper', () => {
      const { result } = renderHook(() => useTresorerieRevenus(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.marquerPaye).toBe('function');
    });
  });

  describe('Business Logic', () => {
    it('should return empty array when no data', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useTresorerieRevenus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.revenus).toEqual([]);
    });

    it('should include etablissements relation in query', async () => {
      mockLimit.mockResolvedValue({ data: mockRevenus, error: null });

      renderHook(() => useTresorerieRevenus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockSelect).toHaveBeenCalled();
      });

      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('etablissements')
      );
    });
  });
});
