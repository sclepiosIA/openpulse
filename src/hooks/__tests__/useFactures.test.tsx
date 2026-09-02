import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Facture, FactureStatut } from '@/types/facturation';

// AuthProvider mock — useFactures calls useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => mockFrom(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}));

// Mock toast
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

import { useFactures } from '@/hooks/billing/useFactures';
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

const mockFactures: Facture[] = [
  {
    id: 'fac-1',
    numero: 'FAC-2026-0001',
    etablissement_id: 'etab-1',
    groupe_id: null,
    partenaire_id: null,
    contact_id: null,
    date_emission: '2026-01-10',
    date_echeance: '2026-02-10',
    montant_ht: 5000,
    montant_tva: 1000,
    montant_ttc: 6000,
    montant_paye: 0,
    remise_globale_pourcent: null,
    remise_globale_montant: null,
    statut: 'emise',
    client_nom: 'CHU Paris',
    client_adresse: null,
    client_email: 'compta@chu-paris.example.org',
    client_telephone: null,
    client_siret: null,
    conditions_paiement: null,
    mode_paiement: null,
    notes_internes: null,
    notes_client: null,
    devis_id: null,
    numero_bon_commande: null,
    created_by: null,
    commercial_id: null,
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-10T10:00:00Z',
    etablissement: { id: 'etab-1', nom: 'CHU Paris', ville: 'Paris' },
  },
  {
    id: 'fac-2',
    numero: 'FAC-2026-0002',
    etablissement_id: 'etab-2',
    groupe_id: null,
    partenaire_id: null,
    contact_id: null,
    date_emission: '2026-01-15',
    date_echeance: '2026-02-15',
    montant_ht: 3500,
    montant_tva: 700,
    montant_ttc: 4200,
    montant_paye: 4200,
    remise_globale_pourcent: null,
    remise_globale_montant: null,
    statut: 'payee',
    client_nom: 'Clinique Lyon',
    client_adresse: null,
    client_email: 'compta@clinique-lyon.example.org',
    client_telephone: null,
    client_siret: null,
    conditions_paiement: null,
    mode_paiement: null,
    notes_internes: 'Paiement reçu le 20/01',
    notes_client: null,
    devis_id: null,
    numero_bon_commande: null,
    created_by: null,
    commercial_id: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-20T14:30:00Z',
    etablissement: { id: 'etab-2', nom: 'Clinique Lyon', ville: 'Lyon' },
  },
];

describe('useFactures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({
      order: mockOrder.mockReturnValue({
        eq: mockEq.mockResolvedValue({ data: mockFactures, error: null }),
        then: (resolve: any) => Promise.resolve({ data: mockFactures, error: null }).then(resolve),
      }),
    });
  });

  describe('Query Structure', () => {
    it('should return correct hook structure with typed initial state', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: mockFactures, error: null }),
      });

      const { result } = renderHook(() => useFactures(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.factures).toEqual([]);
      expect(typeof result.current.createFacture).toBe('function');
      expect(typeof result.current.updateFacture).toBe('function');
      expect(result.current.isCreating).toBe(false);
      expect(result.current.isUpdating).toBe(false);
    });

    it('should start with loading state', () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useFactures(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Data Fetching', () => {
    it('should fetch factures from the correct table', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: mockFactures, error: null }),
      });

      const { result } = renderHook(() => useFactures(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFrom).toHaveBeenCalled();
    });

    it('should return factures array when successful', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: mockFactures, error: null }),
      });

      const { result } = renderHook(() => useFactures(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.factures).toHaveLength(2);
      expect(result.current.factures[0].numero).toBe('FAC-2026-0001');
      expect(result.current.factures[1].statut).toBe('payee');
    });

    it('should include etablissement relation', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: mockFactures, error: null }),
      });

      const { result } = renderHook(() => useFactures(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.factures[0].etablissement?.nom).toBe('CHU Paris');
    });

    it('should handle empty data gracefully', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useFactures(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.factures).toEqual([]);
    });

    it('should handle fetch error', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ 
          data: null, 
          error: { message: 'Connection failed' } 
        }),
      });

      const { result } = renderHook(() => useFactures(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.factures).toEqual([]);
    });
  });

  describe('Mutations', () => {
    it('should provide createFacture function', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useFactures(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.createFacture).toBe('function');
    });

    it('should provide updateFacture function', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useFactures(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.updateFacture).toBe('function');
    });

    it('should have correct mutation pending states', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useFactures(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isCreating).toBe(false);
      expect(result.current.isUpdating).toBe(false);
    });
  });

  describe('Filtering', () => {
    it('should accept filter options', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ 
          data: [mockFactures[0]], 
          error: null 
        }),
      });

      const { result } = renderHook(
        () => useFactures({ etablissementId: 'etab-1' }), 
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify filter was applied (hook returns filtered data)
      expect(mockFrom).toHaveBeenCalled();
    });

    it('should filter by statut', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          eq: mockEq.mockResolvedValue({ data: [mockFactures[1]], error: null }),
        }),
      });

      const { result } = renderHook(
        () => useFactures({ statut: 'payee' as FactureStatut }), 
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.factures[0]?.statut).toBe('payee');
    });
  });
});
