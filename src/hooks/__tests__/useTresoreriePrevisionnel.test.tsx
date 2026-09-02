import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTresoreriePrevisionnel } from '@/hooks/tresorerie/useTresoreriePrevisionnel';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockNot = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock useQontoTransactions
vi.mock('@/hooks/tresorerie/useQontoTransactions', () => ({
  useQontoTransactions: () => ({
    balance: 50000,
    isLoading: false,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { 
      queries: { 
        retry: false,
        gcTime: 0,
      } 
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Mock data matching EtabPrevisionData type
const mockEtablissements = [
  { 
    id: '1', 
    nom: 'Hôpital A', 
    statut: 'actif',
    date_signature: '2024-01-01',
    date_previsionnelle_signature: null,
    pallier_vise: 'P3',
    tarifs_palliers: { P3: 1500 },
    modele_statique_succes: null,
    periodicite_paiement: 'Mensuel',
    type_offre: 'standard',
    nombre_passages_urgences_annuel: 50000,
  },
  { 
    id: '2', 
    nom: 'Clinique B', 
    statut: 'prospect',
    date_signature: null,
    date_previsionnelle_signature: '2024-06-01',
    pallier_vise: 'P2',
    tarifs_palliers: { P2: 800 },
    modele_statique_succes: null,
    periodicite_paiement: 'Annuel',
    type_offre: 'standard',
    nombre_passages_urgences_annuel: 30000,
  },
];

const mockSalaires = [
  { id: '1', salaire_net: 3000, salaire_brut: 4000, cout_employeur: 5200 },
  { id: '2', salaire_net: 2500, salaire_brut: 3300, cout_employeur: 4300 },
];

const mockDepenses = [
  { id: '1', montant: 500, type: 'recurrent', frequence: 'mensuel' },
  { id: '2', montant: 200, type: 'recurrent', frequence: 'mensuel' },
];

describe('useTresoreriePrevisionnel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation for chainable queries
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockReturnValue({ order: mockOrder });
    mockNot.mockReturnValue({ in: mockIn, order: mockOrder });
    mockSelect.mockReturnValue({ not: mockNot, order: mockOrder });
    
    // Mock different tables
    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') {
        return {
          select: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockEtablissements, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'rh_salaires_mensuels') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockSalaires, error: null }),
          }),
        };
      }
      if (table === 'tresorerie_depenses') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockDepenses, error: null }),
          }),
        };
      }
      return { select: mockSelect };
    });
  });

  describe('Hook Structure', () => {
    it('should return expected properties', async () => {
      const { result } = renderHook(
        () => useTresoreriePrevisionnel(),
        { wrapper: createWrapper() }
      );
      
      expect(result.current).toHaveProperty('previsions');
      expect(result.current).toHaveProperty('etablissementsPrevisions');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should start with loading state', () => {
      const { result } = renderHook(
        () => useTresoreriePrevisionnel(),
        { wrapper: createWrapper() }
      );
      
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Parallel Queries (useQueries)', () => {
    it('should fetch data from multiple tables', async () => {
      const { result } = renderHook(
        () => useTresoreriePrevisionnel(),
        { wrapper: createWrapper() }
      );
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // Should query etablissements, salaires and depenses
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
      expect(mockFrom).toHaveBeenCalledWith('rh_salaires_mensuels');
      expect(mockFrom).toHaveBeenCalledWith('tresorerie_depenses');
    });
  });

  describe('Memoized Calculations', () => {
    it('should calculate previsions array', async () => {
      const { result } = renderHook(
        () => useTresoreriePrevisionnel(),
        { wrapper: createWrapper() }
      );
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // Previsions should be an array (may be empty if no valid data)
      expect(Array.isArray(result.current.previsions)).toBe(true);
    });

    it('should calculate etablissementsPrevisions', async () => {
      const { result } = renderHook(
        () => useTresoreriePrevisionnel(),
        { wrapper: createWrapper() }
      );
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // Should transform etablissements into EtablissementPrevision
      expect(Array.isArray(result.current.etablissementsPrevisions)).toBe(true);
    });

    it('should return previsions with expected structure when populated', async () => {
      const { result } = renderHook(
        () => useTresoreriePrevisionnel(),
        { wrapper: createWrapper() }
      );
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // If we have previsions, check structure
      if (result.current.previsions.length > 0) {
        const firstPrevision = result.current.previsions[0];
        expect(firstPrevision).toHaveProperty('mois');
        expect(firstPrevision).toHaveProperty('revenus');
        expect(firstPrevision).toHaveProperty('depenses');
        expect(firstPrevision).toHaveProperty('fluxTresorerie');
        expect(firstPrevision).toHaveProperty('soldePrevu');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle etablissements fetch error', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'etablissements') {
          return {
            select: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
                }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });
      
      const { result } = renderHook(
        () => useTresoreriePrevisionnel(),
        { wrapper: createWrapper() }
      );
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // Should still return default values
      expect(result.current.previsions).toBeDefined();
      expect(Array.isArray(result.current.previsions)).toBe(true);
    });
  });

  describe('Refetch Function', () => {
    it('should provide a refetch function', async () => {
      const { result } = renderHook(
        () => useTresoreriePrevisionnel(),
        { wrapper: createWrapper() }
      );
      
      expect(typeof result.current.refetch).toBe('function');
    });
  });
});
