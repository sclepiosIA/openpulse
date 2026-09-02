import * as React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useGroupesForEtablissement,
  useEtablissementsInGroupe,
  useAddEtablissementToGroupe,
  useRemoveEtablissementFromGroupe,
  useUpdateEtablissementGroupe,
} from './useEtablissementGroupes';

const {
  GROUPES_ROWS,
  ETABLISSEMENTS_ROWS,
  INSERT_RESULT,
  UPDATE_RESULT,
  mockToast,
  mockUseToast,
  mockSanitizeSupabaseError,
  mockFrom,
  builderState,
  resetBuilderState,
} = vi.hoisted(() => {
  const GROUPES_ROWS = [
    {
      id: 'rel-1',
      etablissement_id: 'eta-1',
      groupe_id: 'grp-1',
      date_entree: '2024-01-10',
      date_sortie: undefined,
      est_etablissement_principal: true,
      role_dans_groupe: 'membre',
      created_at: '2024-01-10T08:00:00',
      groupe: {
        id: 'grp-1',
        nom: 'Groupe Alpha',
        type: 'reseau',
        logo_url: null,
      },
    },
  ];

  const ETABLISSEMENTS_ROWS = [
    {
      id: 'rel-1',
      etablissement_id: 'eta-1',
      groupe_id: 'grp-1',
      date_entree: '2024-01-10',
      date_sortie: null,
      est_etablissement_principal: true,
      role_dans_groupe: 'principal',
      created_at: '2024-01-10T08:00:00',
      etablissement: {
        id: 'eta-1',
        nom: 'Établissement Central',
      },
    },
    {
      id: 'rel-2',
      etablissement_id: 'eta-2',
      groupe_id: 'grp-1',
      date_entree: '2024-02-01',
      date_sortie: null,
      est_etablissement_principal: false,
      role_dans_groupe: 'secondaire',
      created_at: '2024-02-01T08:00:00',
      etablissement: {
        id: 'eta-2',
        nom: 'Établissement Annexe',
      },
    },
  ];

  const INSERT_RESULT = {
    id: 'rel-new',
    etablissement_id: 'eta-2',
    groupe_id: 'grp-1',
    date_entree: '2024-03-01',
    est_etablissement_principal: false,
    role_dans_groupe: 'membre',
    created_at: '2024-03-01T09:00:00',
  };

  const UPDATE_RESULT = {
    id: 'rel-1',
    etablissement_id: 'eta-1',
    groupe_id: 'grp-1',
    date_entree: '2024-01-10',
    date_sortie: undefined,
    est_etablissement_principal: false,
    role_dans_groupe: 'coordinateur',
    created_at: '2024-01-10T08:00:00',
  };

  const mockToast = vi.fn();
  const mockUseToast = vi.fn(() => ({ toast: mockToast }));
  const mockSanitizeSupabaseError = vi.fn((error: { message?: string }) => error.message ?? 'unknown');

  const builderState = {
    mode: 'success' as 'success' | 'error',
    resultData: GROUPES_ROWS as unknown,
    error: null as null | { message: string },
    calls: {
      from: [] as string[],
      select: [] as unknown[][],
      eq: [] as Array<[string, unknown]>,
      is: [] as Array<[string, unknown]>,
      order: [] as Array<[string, unknown]>,
      insert: [] as unknown[],
      update: [] as unknown[],
      single: 0,
      maybeSingle: 0,
    },
  };

  const resetBuilderState = () => {
    builderState.mode = 'success';
    builderState.resultData = GROUPES_ROWS;
    builderState.error = null;
    builderState.calls.from = [];
    builderState.calls.select = [];
    builderState.calls.eq = [];
    builderState.calls.is = [];
    builderState.calls.order = [];
    builderState.calls.insert = [];
    builderState.calls.update = [];
    builderState.calls.single = 0;
    builderState.calls.maybeSingle = 0;
  };

  const resolveResult = () =>
    Promise.resolve(
      builderState.mode === 'error'
        ? { data: null, error: builderState.error ?? { message: 'x' } }
        : { data: builderState.resultData, error: null }
    );

  const createBuilder = () => {
    const builder = {
      select: vi.fn((...args: unknown[]) => {
        builderState.calls.select.push(args);
        return builder;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        builderState.calls.eq.push([column, value]);
        return builder;
      }),
      is: vi.fn((column: string, value: unknown) => {
        builderState.calls.is.push([column, value]);
        return builder;
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn((column: string, value: unknown) => {
        builderState.calls.order.push([column, value]);
        return builder;
      }),
      limit: vi.fn(() => builder),
      insert: vi.fn((payload: unknown) => {
        builderState.calls.insert.push(payload);
        return builder;
      }),
      update: vi.fn((payload: unknown) => {
        builderState.calls.update.push(payload);
        return builder;
      }),
      delete: vi.fn(() => builder),
      single: vi.fn(() => {
        builderState.calls.single += 1;
        return resolveResult();
      }),
      maybeSingle: vi.fn(() => {
        builderState.calls.maybeSingle += 1;
        return resolveResult();
      }),
      then: (
        onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => resolveResult().then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) => resolveResult().catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    builderState.calls.from.push(table);
    return createBuilder();
  });

  return {
    GROUPES_ROWS,
    ETABLISSEMENTS_ROWS,
    INSERT_RESULT,
    UPDATE_RESULT,
    mockToast,
    mockUseToast,
    mockSanitizeSupabaseError,
    mockFrom,
    builderState,
    resetBuilderState,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: mockUseToast,
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('./useGroupes', () => ({
  groupeKeys: {
    detail: (id: string) => ['groupes', 'detail', id],
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient, invalidateQueriesSpy };
}

describe('useEtablissementGroupes', () => {
  beforeEach(() => {
    resetBuilderState();
    mockFrom.mockClear();
    mockToast.mockClear();
    mockUseToast.mockClear();
    mockSanitizeSupabaseError.mockClear();
  });

  it('charge les groupes pour un établissement avec les bons filtres', async () => {
    builderState.mode = 'success';
    builderState.resultData = GROUPES_ROWS;

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useGroupesForEtablissement('eta-1'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('etablissements_groupes');
    expect(builderState.calls.eq).toContainEqual(['etablissement_id', 'eta-1']);
    expect(builderState.calls.is).toContainEqual(['date_sortie', null]);
    expect(result.current.data).toEqual(GROUPES_ROWS);
    expect(result.current.data?.[0].groupe.nom).toBe('Groupe Alpha');
    expect(result.current.data?.[0].groupe.type).toBe('reseau');
    expect(result.current.data?.[0].est_etablissement_principal).toBe(true);
  });

  it('remonte une erreur pour les groupes établissement si la requête échoue', async () => {
    builderState.mode = 'error';
    builderState.error = { message: 'x' };

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useGroupesForEtablissement('eta-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(builderState.calls.eq).toContainEqual(['etablissement_id', 'eta-1']);
    expect(builderState.calls.is).toContainEqual(['date_sortie', null]);
  });

  it('charge les établissements d’un groupe triés par établissement principal', async () => {
    builderState.mode = 'success';
    builderState.resultData = ETABLISSEMENTS_ROWS;

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementsInGroupe('grp-1'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('etablissements_groupes');
    expect(builderState.calls.eq).toContainEqual(['groupe_id', 'grp-1']);
    expect(builderState.calls.is).toContainEqual(['date_sortie', null]);
    expect(builderState.calls.order).toContainEqual(['est_etablissement_principal', { ascending: false }]);
    expect(result.current.data).toEqual(ETABLISSEMENTS_ROWS);
    expect(result.current.data?.[0].etablissement.nom).toBe('Établissement Central');
    expect(result.current.data?.[1].etablissement.nom).toBe('Établissement Annexe');
    expect(result.current.data?.[1].est_etablissement_principal).toBe(false);
  });

  it('remonte une erreur pour les établissements du groupe si la requête échoue', async () => {
    builderState.mode = 'error';
    builderState.error = { message: 'x' };

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useEtablissementsInGroupe('grp-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(builderState.calls.eq).toContainEqual(['groupe_id', 'grp-1']);
    expect(builderState.calls.is).toContainEqual(['date_sortie', null]);
    expect(builderState.calls.order).toContainEqual(['est_etablissement_principal', { ascending: false }]);
  });

  it('ajoute un établissement à un groupe, invalide les bonnes clés et affiche un toast succès', async () => {
    builderState.mode = 'success';
    builderState.resultData = INSERT_RESULT;

    const payload = {
      etablissement_id: 'eta-2',
      groupe_id: 'grp-1',
      est_etablissement_principal: false,
      role_dans_groupe: 'membre',
    };

    const { Wrapper, invalidateQueriesSpy } = createWrapper();

    const { result } = renderHook(() => useAddEtablissementToGroupe(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements_groupes');
    expect(builderState.calls.insert).toContainEqual(payload);
    expect(builderState.calls.single).toBe(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['etablissement-groupes', 'eta-2'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['groupe-etablissements', 'grp-1'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['groupes', 'detail', 'grp-1'],
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Établissement ajouté au groupe avec succès',
    });
  });

  it('gère l’erreur duplicate lors de l’ajout', async () => {
    builderState.mode = 'error';
    builderState.error = { message: 'duplicate key value' };

    const payload = {
      etablissement_id: 'eta-2',
      groupe_id: 'grp-1',
      est_etablissement_principal: false,
      role_dans_groupe: 'membre',
    };

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useAddEtablissementToGroupe(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toEqual({ message: 'duplicate key value' });
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'duplicate key value' });
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: "Cet établissement est déjà dans ce groupe",
      variant: 'destructive',
    });
  });

  it('retire un établissement du groupe avec date_sortie et invalide les requêtes', async () => {
    builderState.mode = 'success';
    builderState.resultData = null;

    const { Wrapper, invalidateQueriesSpy } = createWrapper();

    const { result } = renderHook(() => useRemoveEtablissementFromGroupe(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'rel-1',
        groupeId: 'grp-1',
        etablissementId: 'eta-1',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements_groupes');
    expect(builderState.calls.update).toHaveLength(1);
    expect(builderState.calls.update[0]).toEqual({
      date_sortie: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(builderState.calls.eq).toContainEqual(['id', 'rel-1']);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['etablissement-groupes', 'eta-1'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['groupe-etablissements', 'grp-1'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['groupes', 'detail', 'grp-1'],
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Établissement retiré du groupe avec succès',
    });
  });

  it('gère l’erreur lors du retrait', async () => {
    builderState.mode = 'error';
    builderState.error = { message: 'x' };

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useRemoveEtablissementFromGroupe(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'rel-1',
          groupeId: 'grp-1',
          etablissementId: 'eta-1',
        })
      ).rejects.toEqual({ message: 'x' });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: "Impossible de retirer l'établissement du groupe",
      variant: 'destructive',
    });
  });

  it('met à jour une relation établissement-groupe et invalide les bonnes clés', async () => {
    builderState.mode = 'success';
    builderState.resultData = UPDATE_RESULT;

    const { Wrapper, invalidateQueriesSpy } = createWrapper();

    const { result } = renderHook(() => useUpdateEtablissementGroupe(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'rel-1',
        data: {
          role_dans_groupe: 'coordinateur',
          est_etablissement_principal: false,
        },
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements_groupes');
    expect(builderState.calls.update).toContainEqual({
      role_dans_groupe: 'coordinateur',
      est_etablissement_principal: false,
    });
    expect(builderState.calls.eq).toContainEqual(['id', 'rel-1']);
    expect(builderState.calls.single).toBe(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['etablissement-groupes', 'eta-1'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['groupe-etablissements', 'grp-1'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['groupes', 'detail', 'grp-1'],
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Relation mise à jour avec succès',
    });
  });

  it('gère l’erreur lors de la mise à jour', async () => {
    builderState.mode = 'error';
    builderState.error = { message: 'x' };

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateEtablissementGroupe(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'rel-1',
          data: {
            role_dans_groupe: 'coordinateur',
          },
        })
      ).rejects.toEqual({ message: 'x' });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de mettre à jour la relation',
      variant: 'destructive',
    });
  });
});