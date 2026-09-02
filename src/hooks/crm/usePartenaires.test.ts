// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useCreatePartenaire,
  useDeletePartenaire,
  usePartenaire,
  usePartenaires,
  useUpdatePartenaire,
} from './usePartenaires';

const {
  PARTENAIRES_ROWS,
  PARTENAIRE_ROW,
  CREATED_PARTENAIRE,
  AUTH_STATE,
  TOAST_FN,
  SANITIZE_FN,
  DEBUG_ERROR_FN,
  mockFrom,
  mockUseToast,
  mockSanitizeSupabaseError,
  mockDebug,
  queryPresetsMock,
  builderState,
} = vi.hoisted(() => {
  const PARTENAIRES_ROWS = [
    {
      id: 'p1',
      nom: 'Alpha Lab',
      type_partenaire: 'institutionnel' as const,
      sous_type: 'universite',
      adresse: '1 rue A',
      code_postal: '75001',
      ville: 'Paris',
      region: 'IDF',
      pays: 'France',
      telephone: '0102030405',
      email: 'contact@alpha.test',
      site_web: 'https://alpha.test',
      email_domains: ['alpha.test'],
      statut_relation: 'actif' as const,
      date_debut_partenariat: '2024-01-01',
      date_fin_partenariat: null,
      responsable_marque_id: 'u1',
      engagement_score: 88,
      dernier_contact: '2024-05-01',
      prochaine_action: 'Relancer',
      valeur_partenariat: 10000,
      notes: 'Important',
      tags: ['sante'],
      logo_url: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      responsable: {
        id: 'u1',
        prenom: 'Jean',
        nom: 'Dupont',
      },
    },
    {
      id: 'p2',
      nom: 'Beta Industries',
      type_partenaire: 'industriel' as const,
      sous_type: null,
      adresse: null,
      code_postal: null,
      ville: 'Lyon',
      region: 'ARA',
      pays: 'France',
      telephone: null,
      email: 'hello@beta.test',
      site_web: null,
      email_domains: ['beta.test', 'mail.beta.test'],
      statut_relation: 'prospect' as const,
      date_debut_partenariat: null,
      date_fin_partenariat: null,
      responsable_marque_id: null,
      engagement_score: 45,
      dernier_contact: null,
      prochaine_action: null,
      valeur_partenariat: null,
      notes: null,
      tags: ['industrie'],
      logo_url: null,
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-02T00:00:00Z',
      responsable: null,
    },
  ];

  const PARTENAIRE_ROW = {
    ...PARTENAIRES_ROWS[0],
    responsable: {
      id: 'u1',
      prenom: 'Jean',
      nom: 'Dupont',
      email: 'jean@sc.test',
    },
  };

  const CREATED_PARTENAIRE = {
    ...PARTENAIRES_ROWS[0],
    id: 'p3',
    nom: 'Gamma Services',
    email_domains: ['gamma.test', 'Gamma-Alt.test'],
  };

  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const TOAST_FN = vi.fn();
  const SANITIZE_FN = vi.fn((error: Error) => `sanitized:${error.message}`);
  const DEBUG_ERROR_FN = vi.fn();
  const mockFrom = vi.fn();
  const mockUseToast = vi.fn(() => ({ toast: TOAST_FN }));
  const mockSanitizeSupabaseError = vi.fn((error: Error) => SANITIZE_FN(error));
  const mockDebug = { error: DEBUG_ERROR_FN };
  const queryPresetsMock = { reference: { staleTime: 30 * 60 * 1000 } };

  const builderState: {
    selectArgByTable: Record<string, string | undefined>;
    eqCalls: Array<{ table: string; column: string; value: unknown }>;
    orderCalls: Array<{ table: string; column: string; options?: unknown }>;
    insertCalls: Array<{ table: string; arg: unknown }>;
    updateCalls: Array<{ table: string; arg: unknown }>;
    deleteCalls: Array<{ table: string }>;
    responseMap: Record<string, { data: unknown; error: unknown }>;
  } = {
    selectArgByTable: {},
    eqCalls: [],
    orderCalls: [],
    insertCalls: [],
    updateCalls: [],
    deleteCalls: [],
    responseMap: {},
  };

  return {
    PARTENAIRES_ROWS,
    PARTENAIRE_ROW,
    CREATED_PARTENAIRE,
    AUTH_STATE,
    TOAST_FN,
    SANITIZE_FN,
    DEBUG_ERROR_FN,
    mockFrom,
    mockUseToast,
    mockSanitizeSupabaseError,
    mockDebug,
    queryPresetsMock,
    builderState,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const makeBuilder = (table: string) => {
    const builder = {
      select: vi.fn((arg?: string) => {
        builderState.selectArgByTable[table] = arg;
        return builder;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        builderState.eqCalls.push({ table, column, value });
        return builder;
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn((column: string, options?: unknown) => {
        builderState.orderCalls.push({ table, column, options });
        return builder;
      }),
      limit: vi.fn(() => builder),
      insert: vi.fn((arg: unknown) => {
        builderState.insertCalls.push({ table, arg });
        return builder;
      }),
      update: vi.fn((arg: unknown) => {
        builderState.updateCalls.push({ table, arg });
        return builder;
      }),
      delete: vi.fn(() => {
        builderState.deleteCalls.push({ table });
        return builder;
      }),
      single: vi.fn(async () => builderState.responseMap[table] ?? { data: null, error: null }),
      maybeSingle: vi.fn(async () => builderState.responseMap[table] ?? { data: null, error: null }),
      then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(builderState.responseMap[table] ?? { data: null, error: null }).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(builderState.responseMap[table] ?? { data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  mockFrom.mockImplementation((table: string) => {
    return makeBuilder(table);
  });

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: mockUseToast,
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: queryPresetsMock,
}));

vi.mock('@/lib/debug', () => ({
  debug: mockDebug,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient, invalidateSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
  builderState.selectArgByTable = {};
  builderState.eqCalls = [];
  builderState.orderCalls = [];
  builderState.insertCalls = [];
  builderState.updateCalls = [];
  builderState.deleteCalls = [];
  builderState.responseMap = {
    partenaires: { data: PARTENAIRES_ROWS, error: null },
    email_domain_mappings: { data: null, error: null },
  };
});

describe('usePartenaires', () => {
  it('charge la liste puis retourne les partenaires triés avec les champs métier attendus', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePartenaires(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFrom).toHaveBeenCalledWith('partenaires');
    expect(builderState.orderCalls).toContainEqual({ table: 'partenaires', column: 'nom', options: { ascending: true } });
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0].nom).toBe('Alpha Lab');
    expect(result.current.data[0].responsable).toEqual({
      id: 'u1',
      prenom: 'Jean',
      nom: 'Dupont',
    });
    expect(result.current.data[1].type_partenaire).toBe('industriel');
    expect(result.current.data[1].email_domains).toEqual(['beta.test', 'mail.beta.test']);
  });

  it('remonte une erreur quand la requête liste échoue', async () => {
    builderState.responseMap = {
      partenaires: { data: null, error: { message: 'x' } },
    };

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePartenaires(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
    expect((result.current.error as Error).message).toBe('x');
    expect(result.current.data).toEqual([]);
  });
});

describe('usePartenaire', () => {
  it('charge un partenaire par id avec le filtre eq et retourne ses détails', async () => {
    builderState.responseMap = {
      partenaires: { data: PARTENAIRE_ROW, error: null },
    };

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePartenaire('p1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFrom).toHaveBeenCalledWith('partenaires');
    expect(builderState.eqCalls).toContainEqual({ table: 'partenaires', column: 'id', value: 'p1' });
    expect(result.current.isError).toBe(false);
    expect(result.current.data?.id).toBe('p1');
    expect(result.current.data?.nom).toBe('Alpha Lab');
    expect(result.current.data?.responsable).toEqual({
      id: 'u1',
      prenom: 'Jean',
      nom: 'Dupont',
      email: 'jean@sc.test',
    });
  });

  it('remonte une erreur quand la requête détail échoue', async () => {
    builderState.responseMap = {
      partenaires: { data: null, error: { message: 'x' } },
    };

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePartenaire('p1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as Error).message).toBe('x');
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreatePartenaire', () => {
  it('crée un partenaire, crée les mappings de domaines normalisés, affiche un toast et invalide les requêtes', async () => {
    builderState.responseMap = {
      partenaires: { data: CREATED_PARTENAIRE, error: null },
      email_domain_mappings: { data: null, error: null },
    };

    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useCreatePartenaire(), { wrapper });

    const payload = {
      nom: 'Gamma Services',
      type_partenaire: 'prestataire' as const,
      pays: 'France',
      email_domains: ['Gamma.test', '  Sales.Gamma.test '],
      statut_relation: 'prospect' as const,
      engagement_score: 10,
      tags: ['service'],
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('partenaires');
    const insertPartenaireCall = builderState.insertCalls.find((c) => c.table === 'partenaires');
    expect(insertPartenaireCall?.arg).toEqual([
      {
        nom: 'Gamma Services',
        type_partenaire: 'prestataire',
        pays: 'France',
        email_domains: ['Gamma.test', '  Sales.Gamma.test '],
        statut_relation: 'prospect',
        engagement_score: 10,
        tags: ['service'],
      },
    ]);

    expect(mockFrom).toHaveBeenCalledWith('email_domain_mappings');
    const insertMappingsCall = builderState.insertCalls.find((c) => c.table === 'email_domain_mappings');
    expect(Array.isArray(insertMappingsCall?.arg)).toBe(true);
    const mappings = (insertMappingsCall?.arg as Array<Record<string, unknown>>) || [];
    expect(mappings).toEqual([
      {
        partenaire_id: 'p3',
        domain: 'gamma.test',
        niveau_mapping: 'partenaire',
        confidence_level: 'high',
        verified: true,
        is_excluded: false,
      },
      {
        partenaire_id: 'p3',
        domain: 'sales.gamma.test',
        niveau_mapping: 'partenaire',
        confidence_level: 'high',
        verified: true,
        is_excluded: false,
      },
    ]);

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Partenaire créé',
      description: 'Le partenaire a été créé avec succès.',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['partenaires'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-domain-mappings'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['unclassified-domains'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
  });

  it('passe en erreur, sanitize le message et affiche un toast destructif si la création échoue', async () => {
    builderState.responseMap = {
      partenaires: { data: null, error: { message: 'x' } },
    };

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreatePartenaire(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          nom: 'Fail Corp',
          type_partenaire: 'institutionnel',
          pays: 'France',
          email_domains: [],
          statut_relation: 'prospect',
          engagement_score: 0,
          tags: [],
        }),
      ).rejects.toMatchObject({ message: 'x' });
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'sanitized:x',
      variant: 'destructive',
    });
  });
});

describe('useUpdatePartenaire', () => {
  it('met à jour un partenaire et invalide la liste et le détail', async () => {
    builderState.responseMap = {
      partenaires: { data: null, error: null },
    };

    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useUpdatePartenaire(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'p1',
        nom: 'Alpha Lab Updated',
        ville: 'Marseille',
        engagement_score: 91,
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('partenaires');
    const updateCall = builderState.updateCalls.find((c) => c.table === 'partenaires');
    expect(updateCall?.arg).toEqual({
      nom: 'Alpha Lab Updated',
      ville: 'Marseille',
      engagement_score: 91,
    });
    expect(builderState.eqCalls).toContainEqual({ table: 'partenaires', column: 'id', value: 'p1' });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Partenaire mis à jour',
      description: 'Les modifications ont été enregistrées.',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['partenaires'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['partenaire', 'p1'] });
  });

  it('remonte une erreur sanitizée si la mise à jour échoue', async () => {
    builderState.responseMap = {
      partenaires: { data: null, error: { message: 'x' } },
    };

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdatePartenaire(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'p1',
          nom: 'Broken Name',
        }),
      ).rejects.toMatchObject({ message: 'x' });
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'sanitized:x',
      variant: 'destructive',
    });
  });
});

describe('useDeletePartenaire', () => {
  it('supprime un partenaire et invalide la liste', async () => {
    builderState.responseMap = {
      partenaires: { data: null, error: null },
    };

    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useDeletePartenaire(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('p2');
    });

    expect(mockFrom).toHaveBeenCalledWith('partenaires');
    const hasDeleteOnPartenaires = builderState.deleteCalls.some((c) => c.table === 'partenaires');
    expect(hasDeleteOnPartenaires).toBe(true);
    expect(builderState.eqCalls).toContainEqual({ table: 'partenaires', column: 'id', value: 'p2' });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Partenaire supprimé',
      description: 'Le partenaire a été supprimé avec succès.',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['partenaires'] });
  });

  it('affiche une erreur sanitizée si la suppression échoue', async () => {
    builderState.responseMap = {
      partenaires: { data: null, error: { message: 'x' } },
    };

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDeletePartenaire(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('p2')).rejects.toMatchObject({ message: 'x' });
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'sanitized:x',
      variant: 'destructive',
    });
  });
});