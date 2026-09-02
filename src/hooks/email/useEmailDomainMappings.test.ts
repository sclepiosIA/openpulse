// @vitest-environment jsdom
import React, { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useEmailDomainMappings,
  useAddDomainMapping,
  useRemoveDomainMapping,
  useUpdateDomainMapping,
} from './useEmailDomainMappings';

const {
  ROWS,
  INSERTED_ROW,
  UPDATED_ROW,
  EXISTING_EXCLUDED,
  TOAST_FN,
  mockFrom,
  mockSanitizeSupabaseError,
  state,
} = vi.hoisted(() => ({
  ROWS: [
    {
      id: 'm1',
      etablissement_id: 'e1',
      groupe_id: null,
      partenaire_id: null,
      domain: 'example.com',
      confidence_level: 'high' as const,
      created_at: '2024-01-01T00:00:00.000Z',
      created_by: 'u1',
      verified: true,
      is_excluded: false,
      prevent_auto: false,
      niveau_mapping: 'etablissement',
      etablissement: { nom: 'Etab One', ville: 'Paris' },
      groupe: undefined,
      partenaire: undefined,
    },
    {
      id: 'm2',
      etablissement_id: null,
      groupe_id: 'g1',
      partenaire_id: null,
      domain: 'group.org',
      confidence_level: 'medium' as const,
      created_at: '2024-01-02T00:00:00.000Z',
      created_by: 'u2',
      verified: false,
      is_excluded: false,
      prevent_auto: false,
      niveau_mapping: 'groupe',
      etablissement: undefined,
      groupe: { nom: 'Groupe One' },
      partenaire: undefined,
    },
  ],
  INSERTED_ROW: {
    id: 'm3',
    etablissement_id: 'e1',
    groupe_id: null,
    partenaire_id: null,
    domain: 'newdomain.com',
    confidence_level: 'high' as const,
    created_at: '2024-01-03T00:00:00.000Z',
    created_by: 'u3',
    verified: true,
    is_excluded: false,
    prevent_auto: false,
    niveau_mapping: 'etablissement',
  },
  UPDATED_ROW: {
    id: 'm4',
    etablissement_id: 'e1',
    groupe_id: null,
    partenaire_id: null,
    domain: 'old.com',
    confidence_level: 'medium' as const,
    created_at: '2024-01-01T00:00:00.000Z',
    created_by: 'u1',
    verified: true,
    is_excluded: false,
    prevent_auto: false,
    niveau_mapping: 'etablissement',
  },
  EXISTING_EXCLUDED: {
    id: 'm4',
    is_excluded: true,
    prevent_auto: true,
  },
  TOAST_FN: vi.fn(),
  mockFrom: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  state: {
    selectResult: { data: null as unknown, error: null as unknown },
    maybeSingleResult: { data: null as unknown, error: null as unknown },
    singleResult: { data: null as unknown, error: null as unknown },
    builderLog: [] as Array<{ method: string; args: unknown[] }>,
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn((...args: unknown[]) => {
        state.builderLog.push({ method: 'select', args });
        return builder;
      }),
      eq: vi.fn((...args: unknown[]) => {
        state.builderLog.push({ method: 'eq', args });
        return builder;
      }),
      gte: vi.fn((...args: unknown[]) => {
        state.builderLog.push({ method: 'gte', args });
        return builder;
      }),
      lte: vi.fn((...args: unknown[]) => {
        state.builderLog.push({ method: 'lte', args });
        return builder;
      }),
      in: vi.fn((...args: unknown[]) => {
        state.builderLog.push({ method: 'in', args });
        return builder;
      }),
      order: vi.fn((...args: unknown[]) => {
        state.builderLog.push({ method: 'order', args });
        return builder;
      }),
      limit: vi.fn((...args: unknown[]) => {
        state.builderLog.push({ method: 'limit', args });
        return builder;
      }),
      insert: vi.fn((...args: unknown[]) => {
        state.builderLog.push({ method: 'insert', args });
        return builder;
      }),
      update: vi.fn((...args: unknown[]) => {
        state.builderLog.push({ method: 'update', args });
        return builder;
      }),
      delete: vi.fn((...args: unknown[]) => {
        state.builderLog.push({ method: 'delete', args });
        return builder;
      }),
      single: vi.fn(async () => state.singleResult),
      maybeSingle: vi.fn(async () => state.maybeSingleResult),
      then: (
        onFulfilled?: (value: typeof state.selectResult) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(state.selectResult).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(state.selectResult).catch(onRejected),
    };
    return builder;
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation((...args: unknown[]) => {
        state.builderLog.push({ method: 'from', args });
        return createBuilder();
      }),
    },
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.selectResult = { data: ROWS, error: null };
  state.maybeSingleResult = { data: null, error: null };
  state.singleResult = { data: INSERTED_ROW, error: null };
  state.builderLog = [];
  mockSanitizeSupabaseError.mockReturnValue('Erreur traitée');
});

describe('useEmailDomainMappings', () => {
  it('charge puis retourne les mappings en excluant les domaines exclus par défaut et filtre par établissement', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useEmailDomainMappings({ etablissementId: 'e1' }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(ROWS);
    expect(result.current.data?.[0].domain).toBe('example.com');
    expect(result.current.data?.[0].etablissement?.nom).toBe('Etab One');
    expect(result.current.data?.[1].groupe?.nom).toBe('Groupe One');

    expect(mockFrom).toHaveBeenCalledWith('email_domain_mappings');
    expect(state.builderLog).toEqual(
      expect.arrayContaining([
        { method: 'from', args: ['email_domain_mappings'] },
        { method: 'select', args: [expect.stringContaining('etablissement:etablissements')] },
        { method: 'order', args: ['created_at', { ascending: false }] },
        { method: 'eq', args: ['is_excluded', false] },
        { method: 'eq', args: ['etablissement_id', 'e1'] },
      ])
    );
  });

  it('inclut les domaines exclus quand includeExcluded vaut true et filtre par groupe', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useEmailDomainMappings({ groupeId: 'g1', includeExcluded: true }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(ROWS);
    expect(state.builderLog).toEqual(
      expect.arrayContaining([{ method: 'eq', args: ['groupe_id', 'g1'] }])
    );
    expect(
      state.builderLog.some(
        (entry) =>
          entry.method === 'eq' &&
          entry.args[0] === 'is_excluded' &&
          entry.args[1] === false
      )
    ).toBe(false);
  });

  it('passe en erreur quand la requête supabase renvoie une erreur', async () => {
    state.selectResult = { data: null, error: { message: 'x' } };

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEmailDomainMappings(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual({ message: 'x' });
  });
});

describe('useAddDomainMapping', () => {
  it('ajoute un nouveau mapping établissement avec domaine normalisé et invalide les requêtes', async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAddDomainMapping(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        etablissementId: 'e1',
        domain: ' NewDomain.com ',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('email_domain_mappings');
    expect(state.builderLog).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['domain', 'newdomain.com'] },
        { method: 'eq', args: ['etablissement_id', 'e1'] },
        {
          method: 'insert',
          args: [
            {
              domain: 'newdomain.com',
              confidence_level: 'high',
              verified: true,
              is_excluded: false,
              prevent_auto: false,
              niveau_mapping: 'etablissement',
              etablissement_id: 'e1',
            },
          ],
        },
      ])
    );

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Domaine ajouté',
      description: "Le domaine a été associé à l'établissement",
    });
  });

  it('réactive un domaine exclu explicitement quand reactivate vaut true', async () => {
    state.maybeSingleResult = { data: EXISTING_EXCLUDED, error: null };
    state.singleResult = { data: UPDATED_ROW, error: null };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddDomainMapping(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        etablissementId: 'e1',
        domain: 'old.com',
        reactivate: true,
        confidenceLevel: 'medium',
      });
    });

    expect(state.builderLog).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['domain', 'old.com'] },
        { method: 'eq', args: ['etablissement_id', 'e1'] },
        {
          method: 'update',
          args: [
            {
              is_excluded: false,
              prevent_auto: false,
              confidence_level: 'medium',
              verified: true,
              niveau_mapping: 'etablissement',
            },
          ],
        },
        { method: 'eq', args: ['id', 'm4'] },
      ])
    );
  });

  it('retourne une erreur métier et affiche un toast destructif si le domaine exclu est réajouté sans réactivation', async () => {
    state.maybeSingleResult = { data: EXISTING_EXCLUDED, error: null };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddDomainMapping(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          etablissementId: 'e1',
          domain: 'old.com',
        })
      ).rejects.toThrow('Utilisez le bouton "Réactiver"');
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur traitée',
      variant: 'destructive',
    });
  });

  it('passe en erreur si linsert retourne une erreur supabase', async () => {
    state.maybeSingleResult = { data: null, error: null };
    state.singleResult = { data: null, error: { message: 'x' } };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddDomainMapping(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          partenaireId: 'p1',
          domain: 'partner.io',
        })
      ).rejects.toEqual({ message: 'x' });
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur traitée',
      variant: 'destructive',
    });
  });
});

describe('useRemoveDomainMapping', () => {
  it('fait un soft delete en marquant is_excluded et prevent_auto', async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRemoveDomainMapping(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('m1');
    });

    expect(state.builderLog).toEqual(
      expect.arrayContaining([
        {
          method: 'update',
          args: [{ is_excluded: true, prevent_auto: true }],
        },
        { method: 'eq', args: ['id', 'm1'] },
      ])
    );

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['email-domain-mappings'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Domaine exclu',
      description: 'Le domaine ne sera plus associé automatiquement',
    });
  });

  it('passe en erreur si la mise à jour échoue', async () => {
    state.selectResult = { data: null, error: { message: 'x' } };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRemoveDomainMapping(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('m1')).rejects.toEqual({ message: 'x' });
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur traitée',
      variant: 'destructive',
    });
  });
});

describe('useUpdateDomainMapping', () => {
  it('met à jour verified et confidence_level puis affiche un toast de succès', async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateDomainMapping(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        mappingId: 'm2',
        verified: true,
        confidenceLevel: 'low',
      });
    });

    expect(state.builderLog).toEqual(
      expect.arrayContaining([
        {
          method: 'update',
          args: [{ verified: true, confidence_level: 'low' }],
        },
        { method: 'eq', args: ['id', 'm2'] },
      ])
    );

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['email-domain-mappings'] });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Domaine mis à jour',
      description: 'Les modifications ont été enregistrées',
    });
  });

  it('passe en erreur si la mise à jour échoue', async () => {
    state.selectResult = { data: null, error: { message: 'x' } };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateDomainMapping(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          mappingId: 'm2',
          verified: false,
        })
      ).rejects.toEqual({ message: 'x' });
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur traitée',
      variant: 'destructive',
    });
  });
});