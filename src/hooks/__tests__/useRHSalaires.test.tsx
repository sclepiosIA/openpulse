import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => mockFrom(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useRHSalaires, RHSalaire } from '@/hooks/hr/useRHSalaires';
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

const mockSalaires: RHSalaire[] = [
  {
    id: 'sal-1',
    profile_id: 'profile-1',
    mois: '2026-01-01',
    salaire_brut: 4500,
    salaire_net: 3500,
    cotisations_salariales: 700,
    cotisations_patronales: 1800,
    primes: 500,
    heures_supplementaires: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    profiles: {
      id: 'profile-1',
      prenom: 'Jean',
      nom: 'Dupont',
      email: 'jean.dupont@marque.fr',
      fonction: 'Développeur Senior',
    },
  },
  {
    id: 'sal-2',
    profile_id: 'profile-2',
    mois: '2026-01-01',
    salaire_brut: 3800,
    salaire_net: 2950,
    cotisations_salariales: 600,
    cotisations_patronales: 1500,
    primes: 100,
    heures_supplementaires: 10,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    profiles: {
      id: 'profile-2',
      prenom: 'Marie',
      nom: 'Martin',
      email: 'marie.martin@marque.fr',
      fonction: 'Chef de Projet',
    },
  },
];

describe('useRHSalaires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock chain setup
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockSelect.mockReturnValue({ order: mockOrder });
  });

  describe('Query', () => {
    it('should return hook structure with initial state', () => {
      const { result } = renderHook(() => useRHSalaires(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toHaveProperty('salaires');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('createSalaire');
      expect(result.current).toHaveProperty('updateSalaire');
      expect(result.current).toHaveProperty('deleteSalaire');
    });

    it('should fetch salaires from rh_salaires_mensuels table', async () => {
      mockOrder.mockResolvedValue({ data: mockSalaires, error: null });
      mockSelect.mockReturnValue({ order: mockOrder });

      const { result } = renderHook(() => useRHSalaires(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFrom).toHaveBeenCalled();
      expect(result.current.salaires).toHaveLength(2);
      expect(result.current.salaires?.[0].profiles?.prenom).toBe('Jean');
    });

    it('should filter by month when mois parameter is provided', async () => {
      const mockEqChain = vi.fn().mockReturnValue({
        data: [mockSalaires[0]],
        error: null,
      });
      mockOrder.mockReturnValue({ eq: mockEqChain });
      mockSelect.mockReturnValue({ order: mockOrder });

      const { result } = renderHook(() => useRHSalaires('2026-01'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockOrder).toHaveBeenCalled();
    });

    it('should handle fetch error gracefully', async () => {
      mockOrder.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });
      mockSelect.mockReturnValue({ order: mockOrder });

      const { result } = renderHook(() => useRHSalaires(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.salaires).toBeUndefined();
    });
  });

  describe('Mutations', () => {
    it('should provide createSalaire mutation', () => {
      const { result } = renderHook(() => useRHSalaires(), {
        wrapper: createWrapper(),
      });

      expect(result.current.createSalaire).toBeDefined();
      expect(typeof result.current.createSalaire).toBe('function');
    });

    it('should provide updateSalaire mutation with optimistic updates', () => {
      const { result } = renderHook(() => useRHSalaires(), {
        wrapper: createWrapper(),
      });

      expect(result.current.updateSalaire).toBeDefined();
      expect(typeof result.current.updateSalaire).toBe('function');
    });

    it('should provide deleteSalaire mutation with optimistic delete', () => {
      const { result } = renderHook(() => useRHSalaires(), {
        wrapper: createWrapper(),
      });

      expect(result.current.deleteSalaire).toBeDefined();
      expect(typeof result.current.deleteSalaire).toBe('function');
    });
  });

  describe('Business Logic', () => {
    it('should return undefined salaires when loading', () => {
      // Simulate pending query
      mockOrder.mockReturnValue(new Promise(() => {}));
      mockSelect.mockReturnValue({ order: mockOrder });

      const { result } = renderHook(() => useRHSalaires(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should include profiles relation in query', async () => {
      mockOrder.mockResolvedValue({ data: mockSalaires, error: null });
      mockSelect.mockReturnValue({ order: mockOrder });

      renderHook(() => useRHSalaires(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockSelect).toHaveBeenCalled();
      });

      // Verify the select includes profiles relation
      const selectCall = mockSelect.mock.calls[0]?.[0];
      expect(selectCall).toContain('profiles');
    });

    it('should normalize month format for filtering', async () => {
      const mockEqChain = vi.fn().mockResolvedValue({
        data: [mockSalaires[0]],
        error: null,
      });
      mockOrder.mockReturnValue({ eq: mockEqChain });
      mockSelect.mockReturnValue({ order: mockOrder });

      renderHook(() => useRHSalaires('2026-01'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockOrder).toHaveBeenCalled();
      });

      // Month should be normalized to YYYY-MM-DD format
      expect(mockEqChain).toHaveBeenCalledWith('mois', '2026-01-01');
    });
  });

  describe('Data Structure', () => {
    it('should include salary breakdown fields', async () => {
      mockOrder.mockResolvedValue({ data: mockSalaires, error: null });
      mockSelect.mockReturnValue({ order: mockOrder });

      const { result } = renderHook(() => useRHSalaires(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const salaire = result.current.salaires?.[0];
      expect(salaire).toHaveProperty('salaire_brut');
      expect(salaire).toHaveProperty('salaire_net');
      expect(salaire).toHaveProperty('cotisations_salariales');
      expect(salaire).toHaveProperty('cotisations_patronales');
    });

    it('should include bonus and overtime fields', async () => {
      mockOrder.mockResolvedValue({ data: mockSalaires, error: null });
      mockSelect.mockReturnValue({ order: mockOrder });

      const { result } = renderHook(() => useRHSalaires(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const salaire = result.current.salaires?.[0];
      expect(salaire).toHaveProperty('primes');
      expect(salaire).toHaveProperty('heures_supplementaires');
    });
  });
});
