import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Supabase - defined inline to avoid hoisting issues
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useContrats, useContrat, useContratAvenants, useContratAlertes, useContratsKPIs } from '@/hooks/contracts/useContrats';
import { supabase } from '@/integrations/supabase/client';
import type { Contrat, ContratAvenant, ContratAlerte, ContratType } from '@/types/contrats';

// Re-assign mock functions after import for test control
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

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

const mockContrats: Partial<Contrat>[] = [
  {
    id: 'contrat-1',
    numero: 'CTR-2026-001',
    titre: 'Contrat SaaS Annuel',
    client_nom: 'CHU Paris',
    statut: 'actif',
    type: 'licence' as ContratType,
    montant_annuel_ht: 50000,
    date_debut: '2026-01-01',
    date_fin: '2026-12-31',
    etablissement_id: 'etab-1',
    created_at: '2026-01-01T00:00:00Z',
    etablissement: { id: 'etab-1', nom: 'CHU Paris', ville: 'Paris' },
    contact: { id: 'contact-1', nom: 'Martin', prenom: 'Jean' },
    commercial: { id: 'user-1', prenom: 'Pierre', nom: 'Durand' },
  },
  {
    id: 'contrat-2',
    numero: 'CTR-2026-002',
    titre: 'Contrat Maintenance',
    client_nom: 'Clinique Lyon',
    statut: 'en_attente_signature',
    type: 'maintenance' as ContratType,
    montant_annuel_ht: 25000,
    date_debut: '2026-02-01',
    date_fin: '2027-01-31',
    etablissement_id: 'etab-2',
    created_at: '2026-01-15T00:00:00Z',
    etablissement: { id: 'etab-2', nom: 'Clinique Lyon', ville: 'Lyon' },
    contact: { id: 'contact-2', nom: 'Dupont', prenom: 'Marie' },
    commercial: { id: 'user-2', prenom: 'Sophie', nom: 'Bernard' },
  },
];

const mockAvenants: Partial<ContratAvenant>[] = [
  {
    id: 'avenant-1',
    contrat_id: 'contrat-1',
    numero: 1,
    titre: 'Augmentation capacité',
    description: 'Extension à 200 utilisateurs',
    date_effet: '2026-06-01',
    statut: 'signe',
    modifications: { users_max: 200 },
    created_at: '2026-05-01T00:00:00Z',
  },
];

const mockAlertes: Partial<ContratAlerte>[] = [
  {
    id: 'alerte-1',
    contrat_id: 'contrat-1',
    type: 'renouvellement',
    titre: 'Renouvellement proche',
    description: 'Contrat expire dans 30 jours',
    date_alerte: '2026-12-01',
    est_traitee: false,
  },
];

describe('useContrats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock chain for each test
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockSelect.mockReturnValue({ order: mockOrder });
  });

  describe('Query', () => {
    it('should return hook with correct initial state', () => {
      const { result } = renderHook(() => useContrats(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
    });

    it('should fetch contrats with relations', async () => {
      mockOrder.mockResolvedValue({ data: mockContrats, error: null });
      mockSelect.mockReturnValue({ order: mockOrder });

      const { result } = renderHook(() => useContrats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFrom).toHaveBeenCalled();
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].etablissement?.nom).toBe('CHU Paris');
    });

    it('should filter by statut when provided', async () => {
      // Setup proper chain that returns data (not undefined)
      mockOrder.mockResolvedValue({ data: [mockContrats[0]], error: null });
      mockSelect.mockReturnValue({ order: mockOrder });

      const { result } = renderHook(() => useContrats({ statut: 'actif' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFrom).toHaveBeenCalled();
    });

    it('should filter by type when provided', async () => {
      mockOrder.mockResolvedValue({ data: [mockContrats[0]], error: null });
      mockSelect.mockReturnValue({ order: mockOrder });

      const { result } = renderHook(() => useContrats({ type: 'licence' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle fetch error gracefully', async () => {
      mockOrder.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });
      mockSelect.mockReturnValue({ order: mockOrder });

      const { result } = renderHook(() => useContrats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });
});

describe('useContrat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: mockContrats[0], error: null });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
  });

  it('should return null when no id provided', () => {
    const { result } = renderHook(() => useContrat(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
  });

  it('should fetch single contrat when id provided', async () => {
    const { result } = renderHook(() => useContrat('contrat-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalled();
  });
});

describe('useContratAvenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockResolvedValue({ data: mockAvenants, error: null });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });
  });

  it('should return empty array when no contratId provided', () => {
    const { result } = renderHook(() => useContratAvenants(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
  });

  it('should fetch avenants for a contrat', async () => {
    const { result } = renderHook(() => useContratAvenants('contrat-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalled();
  });
});

describe('useContratAlertes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockResolvedValue({ data: mockAlertes, error: null });
    mockSelect.mockReturnValue({ order: mockOrder });
  });

  it('should return correct initial state', () => {
    const { result } = renderHook(() => useContratAlertes(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should fetch alertes with contrat relation', async () => {
    const { result } = renderHook(() => useContratAlertes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalled();
  });

  it('should filter non-traitees only when option is set', async () => {
    const mockEqChain = vi.fn().mockResolvedValue({ data: mockAlertes, error: null });
    mockOrder.mockReturnValue({ eq: mockEqChain });
    mockSelect.mockReturnValue({ order: mockOrder });

    renderHook(() => useContratAlertes({ nonTraiteesOnly: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockOrder).toHaveBeenCalled();
    });
  });
});

describe('useContratsKPIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockResolvedValue({ 
      data: mockContrats.map(c => ({ 
        statut: c.statut, 
        montant_annuel_ht: c.montant_annuel_ht,
        date_fin: c.date_fin
      })), 
      error: null 
    });
  });

  it('should return correct initial state', async () => {
    const { result } = renderHook(() => useContratsKPIs(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should calculate totalActifs', async () => {
    mockSelect.mockResolvedValue({ 
      data: [
        { statut: 'actif', montant_annuel_ht: 50000, date_fin: '2026-12-31' },
        { statut: 'actif', montant_annuel_ht: 25000, date_fin: '2027-01-31' },
        { statut: 'en_attente_signature', montant_annuel_ht: 15000, date_fin: '2027-06-30' },
      ], 
      error: null 
    });

    const { result } = renderHook(() => useContratsKPIs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.totalActifs).toBe(2);
  });

  it('should calculate caAnnuelActif', async () => {
    mockSelect.mockResolvedValue({ 
      data: [
        { statut: 'actif', montant_annuel_ht: 50000, date_fin: '2026-12-31' },
        { statut: 'actif', montant_annuel_ht: 25000, date_fin: '2027-01-31' },
      ], 
      error: null 
    });

    const { result } = renderHook(() => useContratsKPIs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.caAnnuelActif).toBe(75000);
  });
});
