import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The hook does TWO independent queries: one follows
// .select().neq().order().limit(), the other .select().eq(). Keep their
// terminal responses separate so an error from either query reaches React Query.

const mockLimit = vi.fn();
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockNeq = vi.fn(() => ({ order: mockOrder }));
const mockAPayerEq = vi.fn();

const mockSelect = vi.fn(() => ({
  neq: mockNeq,
  eq: mockAPayerEq,
  order: mockOrder,
}));

const mockInsert = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
const mockDelete = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));


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
      delete: mockDelete,
    })),
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { useTresorerieDepenses, Depense } from '@/hooks/tresorerie/useTresorerieDepenses';

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

const mockDepenses: Depense[] = [
  {
    id: 'dep-1',
    nom: 'Hébergement Cloud',
    montant: 2500,
    date_prevue: '2026-01-15',
    date_paiement_reel: null,
    statut: 'en_attente',
    categorie_code: 'infrastructure',
    source: null,
    notes: 'Serveurs production',
  },
  {
    id: 'dep-2',
    nom: 'Licences logiciels',
    montant: 1200,
    date_prevue: '2026-01-10',
    date_paiement_reel: '2026-01-10',
    statut: 'paye',
    categorie_code: 'logiciels',
    source: null,
    notes: null,
  },
  {
    id: 'dep-3',
    nom: 'Formation équipe',
    montant: 3500,
    date_prevue: '2026-02-01',
    date_paiement_reel: null,
    statut: 'en_attente',
    categorie_code: 'formation',
    source: null,
    notes: 'Certification Azure',
  },
];

describe('useTresorerieDepenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: both queries return empty
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockAPayerEq.mockResolvedValue({ data: [], error: null });
  });

  describe('Query', () => {
    it('should return hook with correct typed initial state', () => {
      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.depenses).toEqual([]);
      expect(typeof result.current.createDepense).toBe('function');
      expect(typeof result.current.updateDepense).toBe('function');
      expect(typeof result.current.deleteDepense).toBe('function');
      expect(typeof result.current.marquerPayee).toBe('function');
    });

    it('should fetch depenses from tresorerie_depenses table', async () => {
      mockLimit.mockResolvedValue({ data: mockDepenses, error: null });
      mockAPayerEq.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.depenses).toHaveLength(3);
      expect(result.current.depenses[0].nom).toBe('Hébergement Cloud');
    });

    it('should call select with correct fields', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });
      mockAPayerEq.mockResolvedValue({ data: [], error: null });

      renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockSelect).toHaveBeenCalled();
      });
    });

    it('should expose a recent-depenses fetch error without retaining stale data', async () => {
      const fetchError = new Error('recent depenses unavailable');
      mockLimit.mockResolvedValue({ data: null, error: fetchError });

      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5_000 });

      expect(result.current.depenses).toEqual([]);
      expect(mockNeq).toHaveBeenCalledWith('date_prevue', '1900-01-01');
      expect(mockAPayerEq).not.toHaveBeenCalled();
    });
  });

  describe('Mutations', () => {
    it('should provide createDepense mutation', () => {
      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.createDepense).toBe('function');
      expect(result.current.isCreating).toBe(false);
    });

    it('should provide updateDepense mutation', () => {
      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.updateDepense).toBe('function');
      expect(result.current.isUpdating).toBe(false);
    });

    it('should provide deleteDepense mutation', () => {
      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.deleteDepense).toBe('function');
      expect(result.current.isDeleting).toBe(false);
    });

    it('should provide marquerPayee helper function', () => {
      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.marquerPayee).toBe('function');
    });
  });

  describe('Business Logic', () => {
    it('should return empty array when no data', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });
      mockAPayerEq.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.depenses).toEqual([]);
    });

    it('should return the empty fallback while exposing an a-payer fetch error', async () => {
      const fetchError = new Error('a payer depenses unavailable');
      mockLimit.mockResolvedValue({ data: [], error: null });
      mockAPayerEq.mockResolvedValue({ data: null, error: fetchError });

      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5_000 });

      expect(result.current.depenses).toEqual([]);
      expect(mockAPayerEq).toHaveBeenCalledWith('date_prevue', '1900-01-01');
    });
  });

  describe('Depense Statuses', () => {
    it('should include depenses with en_attente status', async () => {
      mockLimit.mockResolvedValue({ data: mockDepenses, error: null });
      mockAPayerEq.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.depenses.length).toBeGreaterThan(0);
      });

      const enAttente = result.current.depenses.filter(d => d.statut === 'en_attente');
      expect(enAttente.length).toBeGreaterThan(0);
    });

    it('should include depenses with paye status', async () => {
      mockLimit.mockResolvedValue({ data: mockDepenses, error: null });
      mockAPayerEq.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.depenses.length).toBeGreaterThan(0);
      });

      const payees = result.current.depenses.filter(d => d.statut === 'paye');
      expect(payees.length).toBeGreaterThan(0);
    });
  });

  describe('Data Structure', () => {
    it('should have required fields for each depense', async () => {
      mockLimit.mockResolvedValue({ data: mockDepenses, error: null });
      mockAPayerEq.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.depenses.length).toBeGreaterThan(0);
      });

      const depense = result.current.depenses[0];
      expect(depense).toHaveProperty('id');
      expect(depense).toHaveProperty('nom');
      expect(depense).toHaveProperty('montant');
      expect(depense).toHaveProperty('date_prevue');
      expect(depense).toHaveProperty('statut');
      expect(depense).toHaveProperty('categorie_code');
    });

    it('should allow nullable fields', async () => {
      mockLimit.mockResolvedValue({ data: mockDepenses, error: null });
      mockAPayerEq.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.depenses.length).toBeGreaterThan(0);
      });

      const unpaid = result.current.depenses.find(d => d.date_paiement_reel === null);
      expect(unpaid).toBeDefined();

      const noNotes = result.current.depenses.find(d => d.notes === null);
      expect(noNotes).toBeDefined();
    });
  });
});
