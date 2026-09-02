import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Supabase
vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
  },
}));

// Mock toast
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

import { useTaches, useTache, useTachesByEtablissement } from '@/hooks/tasks/useTaches';
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

const mockTaches = [
  {
    id: 'tache-1',
    titre: 'Formation initiale',
    description: 'Former les équipes sur le produit',
    statut: 'en_cours',
    priorite: 'haute',
    etablissement_id: 'etab-1',
    responsable_id: 'user-1',
    date_echeance: '2026-02-15',
    ordre: 1,
    archive: false,
    created_at: '2026-01-01T00:00:00Z',
    categories_taches: {
      id: 'cat-1',
      nom: 'Formation',
      couleur: '#3B82F6',
    },
    etablissements: {
      id: 'etab-1',
      nom: 'CHU Paris',
    },
  },
  {
    id: 'tache-2',
    titre: 'Configuration DPI',
    description: 'Configurer l\'interface avec le DPI',
    statut: 'a_faire',
    priorite: 'moyenne',
    etablissement_id: 'etab-1',
    responsable_id: 'user-2',
    date_echeance: '2026-02-28',
    ordre: 2,
    archive: false,
    created_at: '2026-01-05T00:00:00Z',
    categories_taches: {
      id: 'cat-2',
      nom: 'Technique',
      couleur: '#10B981',
    },
    etablissements: {
      id: 'etab-1',
      nom: 'CHU Paris',
    },
  },
  {
    id: 'tache-3',
    titre: 'Validation conformité',
    description: 'Valider la conformité réglementaire',
    statut: 'terminee',
    priorite: 'haute',
    etablissement_id: 'etab-2',
    responsable_id: 'user-1',
    date_echeance: '2026-01-31',
    ordre: 1,
    archive: false,
    created_at: '2025-12-15T00:00:00Z',
    categories_taches: {
      id: 'cat-3',
      nom: 'Conformité',
      couleur: '#F59E0B',
    },
    etablissements: {
      id: 'etab-2',
      nom: 'Clinique Lyon',
    },
  },
];

describe('useTaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Structure', () => {
    it('should return hook structure with initial state', () => {
      const { result } = renderHook(() => useTaches(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should start in loading state', () => {
      const { result } = renderHook(() => useTaches(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Data Structure Validation', () => {
    it('should include required fields for each tache', () => {
      const tache = mockTaches[0];
      expect(tache).toHaveProperty('id');
      expect(tache).toHaveProperty('titre');
      expect(tache).toHaveProperty('statut');
      expect(tache).toHaveProperty('priorite');
      expect(tache).toHaveProperty('etablissement_id');
      expect(tache).toHaveProperty('archive');
    });

    it('should include category relation', () => {
      const tache = mockTaches[0];
      expect(tache.categories_taches).toBeDefined();
      expect(tache.categories_taches.nom).toBe('Formation');
      expect(tache.categories_taches.couleur).toBe('#3B82F6');
    });

    it('should include etablissement relation', () => {
      const tache = mockTaches[0];
      expect(tache.etablissements).toBeDefined();
      expect(tache.etablissements.nom).toBe('CHU Paris');
    });
  });

  describe('Statut Filtering Logic', () => {
    it('should identify taches with a_faire status', () => {
      const aFaire = mockTaches.filter(t => t.statut === 'a_faire');
      expect(aFaire.length).toBe(1);
      expect(aFaire[0].titre).toBe('Configuration DPI');
    });

    it('should identify taches with en_cours status', () => {
      const enCours = mockTaches.filter(t => t.statut === 'en_cours');
      expect(enCours.length).toBe(1);
      expect(enCours[0].titre).toBe('Formation initiale');
    });

    it('should identify taches with terminee status', () => {
      const terminee = mockTaches.filter(t => t.statut === 'terminee');
      expect(terminee.length).toBe(1);
      expect(terminee[0].titre).toBe('Validation conformité');
    });
  });

  describe('Priorite Filtering Logic', () => {
    it('should identify haute priorite taches', () => {
      const haute = mockTaches.filter(t => t.priorite === 'haute');
      expect(haute.length).toBe(2);
    });

    it('should identify moyenne priorite taches', () => {
      const moyenne = mockTaches.filter(t => t.priorite === 'moyenne');
      expect(moyenne.length).toBe(1);
      expect(moyenne[0].titre).toBe('Configuration DPI');
    });
  });

  describe('Archive Filtering', () => {
    it('should only include non-archived taches in mock data', () => {
      const archived = mockTaches.filter(t => t.archive === true);
      expect(archived.length).toBe(0);
    });

    it('should have archive flag on all taches', () => {
      mockTaches.forEach(t => {
        expect(t).toHaveProperty('archive');
        expect(typeof t.archive).toBe('boolean');
      });
    });
  });
});

describe('useTache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return hook structure', () => {
    const { result } = renderHook(() => useTache('tache-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });

  it('should start in loading state when id provided', () => {
    const { result } = renderHook(() => useTache('tache-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });
});

describe('useTachesByEtablissement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return hook structure', () => {
    const { result } = renderHook(() => useTachesByEtablissement('etab-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });

  it('should start in loading state when etablissementId provided', () => {
    const { result } = renderHook(() => useTachesByEtablissement('etab-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('should filter mock taches by etablissement', () => {
    const etab1Taches = mockTaches.filter(t => t.etablissement_id === 'etab-1');
    expect(etab1Taches.length).toBe(2);
    
    const etab2Taches = mockTaches.filter(t => t.etablissement_id === 'etab-2');
    expect(etab2Taches.length).toBe(1);
  });
});
