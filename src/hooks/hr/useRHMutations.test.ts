import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useCreateDemandeFormation,
  useCreateObjectif,
  useCreateProductionNote,
} from './useRHMutations';

const { USER, mockFrom, mockInsert, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  USER: { id: 'u1', email: 't@t.co' },
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: USER, session: { user: USER }, isLoading: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ insert: mockInsert });
});

describe('useCreateDemandeFormation', () => {
  const formData = {
    titre: 'Formation TS',
    description: 'Apprendre TypeScript',
    type: 'technique',
    organisme: 'OpenClassrooms',
    cout_estime: '1200.50',
    lien_formation: 'https://example.com/formation',
    date_souhaitee: '2025-06-01',
  };

  it('insère la demande dans rh_demandes_formation avec les bonnes valeurs', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateDemandeFormation(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(formData);
    });

    expect(mockFrom).toHaveBeenCalledWith('rh_demandes_formation');
    expect(mockInsert).toHaveBeenCalledWith({
      profile_id: 'u1',
      titre: 'Formation TS',
      description: 'Apprendre TypeScript',
      type: 'technique',
      organisme: 'OpenClassrooms',
      cout_estime: 1200.5,
      lien_formation: 'https://example.com/formation',
      date_souhaitee: '2025-06-01',
      statut: 'en_attente',
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Demande de formation soumise avec succès');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('convertit cout_estime vide et champs optionnels vides en null', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateDemandeFormation(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        ...formData,
        cout_estime: '',
        lien_formation: '',
        date_souhaitee: '',
      });
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cout_estime: null,
        lien_formation: null,
        date_souhaitee: null,
      })
    );
  });

  it("passe en erreur et affiche un toast d'erreur si l'insert échoue", async () => {
    mockInsert.mockResolvedValue({ error: { message: 'x' } });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateDemandeFormation(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(formData).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la soumission');
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

describe('useCreateObjectif', () => {
  const objectifData = {
    titre: 'Objectif ventes',
    description: 'Augmenter le CA',
    type: 'commercial',
    cible_valeur: '50',
    unite: 'k€',
    periode: 'trimestre',
    date_debut: '2025-01-01',
    date_fin: '2025-03-31',
  };

  it('insère un objectif dans rh_objectifs avec statut en_cours et created_by', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateObjectif(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(objectifData);
    });

    expect(mockFrom).toHaveBeenCalledWith('rh_objectifs');
    expect(mockInsert).toHaveBeenCalledWith({
      profile_id: 'u1',
      titre: 'Objectif ventes',
      description: 'Augmenter le CA',
      type: 'commercial',
      cible_valeur: 50,
      unite: 'k€',
      periode: 'trimestre',
      date_debut: '2025-01-01',
      date_fin: '2025-03-31',
      statut: 'en_cours',
      created_by: 'u1',
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Objectif créé avec succès');
  });

  it('invalide la query rh-objectifs après succès', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateObjectif(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(objectifData);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rh-objectifs'] });
  });

  it('calcule des dates par défaut quand date_debut et date_fin sont vides', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateObjectif(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ...objectifData, date_debut: '', date_fin: '' });
    });

    const today = new Date();
    const expectedDebut = today.toISOString().split('T')[0];
    const expectedFin = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        date_debut: expectedDebut,
        date_fin: expectedFin,
      })
    );
  });

  it("affiche un toast d'erreur en cas d'échec", async () => {
    mockInsert.mockResolvedValue({ error: { message: 'x' } });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateObjectif(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(objectifData).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la création de l'objectif");
  });
});

describe('useCreateProductionNote', () => {
  it('insère une note rapide dans customer_activities', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProductionNote(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ etablissement_id: 'etab-1', content: 'Client satisfait' });
    });

    expect(mockFrom).toHaveBeenCalledWith('customer_activities');
    expect(mockInsert).toHaveBeenCalledWith({
      etablissement_id: 'etab-1',
      title: 'Note rapide',
      description: 'Client satisfait',
      activity_type: 'note',
      created_by: 'u1',
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Note ajoutée avec succès');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("passe en erreur et affiche le toast d'erreur si l'insert échoue", async () => {
    mockInsert.mockResolvedValue({ error: { message: 'x' } });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProductionNote(), { wrapper: Wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ etablissement_id: 'etab-1', content: 'Note' })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'ajout de la note");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});