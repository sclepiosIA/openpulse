import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useEmailSpecificMappings,
  useAddEmailSpecificMapping,
  useRemoveEmailSpecificMapping,
  useUpdateEmailSpecificMapping,
  useMarkEmailAsUnaffiliated,
} from './useEmailSpecificMappings';

const {
  MAPPINGS_ROWS,
  TOAST_FN,
  SANITIZED_ERROR,
  mockFrom,
  mockSanitizeSupabaseError,
  queryState,
  mutationState,
  builder,
} = vi.hoisted(() => {
  const MAPPINGS_ROWS = [
    {
      id: 'map-1',
      email_address: 'alice@example.com',
      etablissement_id: 'eta-1',
      groupe_id: 'grp-1',
      partenaire_id: 'par-1',
      profile_id: 'pro-1',
      niveau_mapping: 'etablissement' as const,
      confidence_level: 'high',
      verified: true,
      notes: 'VIP',
      created_at: '2024-01-01T10:00:00.000Z',
      created_by: 'user-1',
      etablissement: {
        id: 'eta-1',
        nom: 'Etablissement A',
        ville: 'Paris',
      },
      groupe: {
        id: 'grp-1',
        nom: 'Groupe A',
      },
      partenaire: {
        id: 'par-1',
        nom: 'Partenaire A',
      },
      profile: {
        id: 'pro-1',
        prenom: 'Alice',
        nom: 'Martin',
      },
    },
  ];

  const TOAST_FN = vi.fn();
  const SANITIZED_ERROR = 'Erreur nettoyée';
  const mockFrom = vi.fn();
  const mockSanitizeSupabaseError = vi.fn(() => SANITIZED_ERROR);

  const queryState: {
    data: unknown;
    error: { message: string } | null;
  } = {
    data: MAPPINGS_ROWS,
    error: null,
  };

  const mutationState: {
    error: { message: string } | null;
    mode: 'query' | 'mutation';
  } = {
    error: null,
    mode: 'query',
  };

  const builder = {
    select: vi.fn(() => {
      mutationState.mode = 'query';
      return builder;
    }),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => {
      mutationState.mode = 'mutation';
      return builder;
    }),
    update: vi.fn(() => {
      mutationState.mode = 'mutation';
      return builder;
    }),
    delete: vi.fn(() => {
      mutationState.mode = 'mutation';
      return builder;
    }),
    single: vi.fn(async () =>
      mutationState.mode === 'mutation'
        ? { data: null, error: mutationState.error }
        : { data: queryState.data, error: queryState.error },
    ),
    maybeSingle: vi.fn(async () =>
      mutationState.mode === 'mutation'
        ? { data: null, error: mutationState.error }
        : { data: queryState.data, error: queryState.error },
    ),
    then: (
      onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      const payload =
        mutationState.mode === 'mutation'
          ? { data: null, error: mutationState.error }
          : { data: queryState.data, error: queryState.error };

      return Promise.resolve(payload).then(onFulfilled, onRejected);
    },
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  };

  return {
    MAPPINGS_ROWS,
    TOAST_FN,
    SANITIZED_ERROR,
    mockFrom,
    mockSanitizeSupabaseError,
    queryState,
    mutationState,
    builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
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

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const createWrapper = (client?: QueryClient) => {
  const queryClient = client ?? createQueryClient();

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const createWrapperWithClient = () => {
  const queryClient = createQueryClient();
  vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
};

beforeEach(() => {
  queryState.data = MAPPINGS_ROWS;
  queryState.error = null;
  mutationState.error = null;
  mutationState.mode = 'query';

  mockFrom.mockReset();
  mockFrom.mockImplementation(() => builder);

  builder.select.mockClear();
  builder.eq.mockClear();
  builder.gte.mockClear();
  builder.lte.mockClear();
  builder.in.mockClear();
  builder.order.mockClear();
  builder.limit.mockClear();
  builder.insert.mockClear();
  builder.update.mockClear();
  builder.delete.mockClear();
  builder.single.mockClear();
  builder.maybeSingle.mockClear();

  TOAST_FN.mockClear();
  mockSanitizeSupabaseError.mockClear();
});

describe('useEmailSpecificMappings', () => {
  it('charge puis retourne les mappings avec filtre etablissement', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailSpecificMappings('eta-1'), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.mappings).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_specific_mappings');
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1');

    expect(result.current.mappings).toHaveLength(1);
    expect(result.current.mappings[0]).toMatchObject({
      id: 'map-1',
      email_address: 'alice@example.com',
      niveau_mapping: 'etablissement',
      confidence_level: 'high',
      verified: true,
      notes: 'VIP',
      etablissement: {
        id: 'eta-1',
        nom: 'Etablissement A',
        ville: 'Paris',
      },
      groupe: {
        id: 'grp-1',
        nom: 'Groupe A',
      },
      partenaire: {
        id: 'par-1',
        nom: 'Partenaire A',
      },
      profile: {
        id: 'pro-1',
        prenom: 'Alice',
        nom: 'Martin',
      },
    });
  });

  it('retourne un tableau vide sans filtre quand aucune donnée', async () => {
    queryState.data = [];

    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailSpecificMappings(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(builder.eq).not.toHaveBeenCalled();
    expect(result.current.mappings).toEqual([]);
  });

  it('passe en erreur si la requête échoue', async () => {
    queryState.error = { message: 'x' };

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result } = renderHook(() => useEmailSpecificMappings('eta-1'), { wrapper });

    await waitFor(() => {
      const query = client.getQueryCache().find({ queryKey: ['email-specific-mappings', 'eta-1'] });
      expect(query?.state.status).toBe('error');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mappings).toEqual([]);
  });
});

describe('useAddEmailSpecificMapping', () => {
  it('insère un mapping normalisé puis invalide les queries et affiche un toast de succès', async () => {
    const { queryClient, wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useAddEmailSpecificMapping(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        email_address: '  Alice@Example.com ',
        etablissement_id: 'eta-1',
        niveau_mapping: 'etablissement',
        notes: 'Note test',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('email_specific_mappings');
    expect(builder.insert).toHaveBeenCalledWith([
      {
        email_address: 'alice@example.com',
        etablissement_id: 'eta-1',
        groupe_id: null,
        partenaire_id: null,
        profile_id: null,
        niveau_mapping: 'etablissement',
        confidence_level: 'high',
        notes: 'Note test',
      },
    ]);

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Mapping créé',
      description: "L'email a été affilié avec succès.",
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-specific-mappings'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['generic-domain-unclassified-emails'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-classification-stats'] });
  });

  it('expose une erreur de mutation et affiche un toast destructif', async () => {
    mutationState.error = { message: 'x' };

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useAddEmailSpecificMapping(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          email_address: 'bob@example.com',
          niveau_mapping: 'partenaire',
        }),
      ).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: SANITIZED_ERROR,
      variant: 'destructive',
    });
  });
});

describe('useRemoveEmailSpecificMapping', () => {
  it('supprime un mapping par id puis invalide les bonnes queries', async () => {
    const { queryClient, wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useRemoveEmailSpecificMapping(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('map-1');
    });

    expect(mockFrom).toHaveBeenCalledWith('email_specific_mappings');
    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('id', 'map-1');

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Mapping supprimé',
      description: "L'affiliation email a été supprimée.",
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-specific-mappings'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
  });

  it('retourne une erreur et affiche un toast destructif si la suppression échoue', async () => {
    mutationState.error = { message: 'x' };

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useRemoveEmailSpecificMapping(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('map-1')).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: SANITIZED_ERROR,
      variant: 'destructive',
    });
  });
});

describe('useUpdateEmailSpecificMapping', () => {
  it('met à jour confiance, vérification et notes puis invalide la query des mappings', async () => {
    const { queryClient, wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useUpdateEmailSpecificMapping(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'map-1',
        confidence_level: 'medium',
        verified: false,
        notes: 'Mise à jour',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('email_specific_mappings');
    expect(builder.update).toHaveBeenCalledWith({
      confidence_level: 'medium',
      verified: false,
      notes: 'Mise à jour',
    });
    expect(builder.eq).toHaveBeenCalledWith('id', 'map-1');

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Mapping mis à jour',
      description: "L'affiliation email a été modifiée.",
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-specific-mappings'] });
  });

  it('retourne une erreur et toast destructif si la mise à jour échoue', async () => {
    mutationState.error = { message: 'x' };

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useUpdateEmailSpecificMapping(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'map-1',
          confidence_level: 'low',
        }),
      ).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: SANITIZED_ERROR,
      variant: 'destructive',
    });
  });
});

describe('useMarkEmailAsUnaffiliated', () => {
  it('insère un email non affilié normalisé puis invalide les queries associées', async () => {
    const { queryClient, wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useMarkEmailAsUnaffiliated(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('  Person@Example.com ');
    });

    expect(mockFrom).toHaveBeenCalledWith('email_specific_mappings');
    expect(builder.insert).toHaveBeenCalledWith([
      {
        email_address: 'person@example.com',
        etablissement_id: null,
        groupe_id: null,
        partenaire_id: null,
        profile_id: null,
        niveau_mapping: 'etablissement',
        confidence_level: 'high',
        is_unaffiliated: true,
        notes: 'Non affilié - Email personnel marqué comme non associé',
      },
    ]);

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Email marqué comme non affilié',
      description: 'Cet email ne sera plus affiché dans la liste.',
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-specific-mappings'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['generic-domain-unclassified-emails'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-classification-stats'] });
  });

  it('retourne une erreur et toast destructif si le marquage échoue', async () => {
    mutationState.error = { message: 'x' };

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useMarkEmailAsUnaffiliated(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('person@example.com')).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: SANITIZED_ERROR,
      variant: 'destructive',
    });
  });
});