/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useEtablissementGroupeId,
  useGroupeFacturationData,
  useEtablissementGroupeFacturation,
  useSaveGroupeFacturation,
} from './useEtablissementGroupeFacturation';

const {
  GROUPE_ID,
  ETABLISSEMENT_ID,
  GROUPE_ROW,
  ETAB_IDS_ROWS,
  GROUPE_ID_RESULT,
  UPDATE_RESULT,
  AUTH_STATE,
  mockFrom,
  mockDebugError,
  mockToastSuccess,
  mockToastError,
  mockNavigate,
} = vi.hoisted(() => ({
  GROUPE_ID: 'grp-1',
  ETABLISSEMENT_ID: 'eta-1',
  GROUPE_ROW: {
    id: 'grp-1',
    nom: 'Groupe Alpha',
    type_offre: 'premium',
    periodicite_paiement: 'mensuel',
    pallier_vise: 'p2',
    modele_statique_succes: 'standard',
    tarifs_palliers: { p1: 100, p2: 200 },
    paiement_initial: 49,
    email_facturation: 'facturation@test.co',
    adresse_facturation: '10 rue Exemple',
    siret_facturation: '12345678901234',
    conditions_paiement_defaut: '30 jours',
    mode_paiement_prefere: 'virement',
    vecteur_achat: 'direct',
  },
  ETAB_IDS_ROWS: [
    { etablissement_id: 'eta-1' },
    { etablissement_id: 'eta-2' },
    { etablissement_id: 'eta-3' },
  ],
  GROUPE_ID_RESULT: { groupe_id: 'grp-1' },
  UPDATE_RESULT: { id: 'grp-1' },
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockDebugError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

type BuilderState = {
  operation: 'select' | 'update' | null;
  filters: Record<string, unknown>;
  values?: unknown;
};

type BuilderResponse = {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

function createBuilder(resolver: (table: string, state: BuilderState) => BuilderResponse | Promise<BuilderResponse>) {
  let tableName = '';
  let operation: 'select' | 'update' | null = null;
  const filters: Record<string, unknown> = {};
  let values: unknown;

  const execute = () => Promise.resolve(resolver(tableName, { operation, filters, values }));

  const builder = {
    select: vi.fn((columns?: unknown, options?: unknown) => {
      operation = 'select';
      filters.__select = columns;
      if (options && typeof options === 'object') {
        filters.__selectOptions = options;
      }
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      filters[`eq:${column}`] = value;
      return builder;
    }),
    gte: vi.fn((column: string, value: unknown) => {
      filters[`gte:${column}`] = value;
      return builder;
    }),
    lte: vi.fn((column: string, value: unknown) => {
      filters[`lte:${column}`] = value;
      return builder;
    }),
    in: vi.fn((column: string, value: unknown) => {
      filters[`in:${column}`] = value;
      return builder;
    }),
    is: vi.fn((column: string, value: unknown) => {
      filters[`is:${column}`] = value;
      return builder;
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      operation = 'update';
      values = payload;
      return builder;
    }),
    update: vi.fn((payload: unknown) => {
      operation = 'update';
      values = payload;
      return builder;
    }),
    delete: vi.fn(() => {
      operation = 'update';
      return builder;
    }),
    single: vi.fn(async () => execute()),
    maybeSingle: vi.fn(async () => execute()),
    then: (onFulfilled: (value: BuilderResponse) => unknown, onRejected?: (reason: unknown) => unknown) =>
      execute().then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      execute().catch(onRejected),
  };

  return {
    setTable(name: string) {
      tableName = name;
      return builder;
    },
    builder,
  };
}

describe('useEtablissementGroupeFacturation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge le groupe_id puis les données de facturation du groupe avec les valeurs métier attendues', async () => {
    mockFrom.mockImplementation((table: string) => {
      const chain = createBuilder(async (currentTable, state) => {
        if (currentTable === 'etablissements_groupes' && state.filters['eq:etablissement_id'] === ETABLISSEMENT_ID) {
          return { data: GROUPE_ID_RESULT, error: null };
        }

        if (currentTable === 'groupes_etablissements' && state.filters['eq:id'] === GROUPE_ID) {
          return { data: GROUPE_ROW, error: null };
        }

        if (currentTable === 'etablissements_groupes' && state.filters['eq:groupe_id'] === GROUPE_ID) {
          return { data: ETAB_IDS_ROWS, error: null };
        }

        if (
          currentTable === 'etablissements' &&
          state.filters['eq:client_facturation'] === 'groupe' &&
          Array.isArray(state.filters['in:id'])
        ) {
          return { data: null, error: null, count: 2 };
        }

        return { data: null, error: null };
      });

      return chain.setTable(table);
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result } = renderHook(() => useEtablissementGroupeFacturation(ETABLISSEMENT_ID, true), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.groupeId).toBe('grp-1');
    expect(result.current.data).toEqual({
      groupe_id: 'grp-1',
      groupe_nom: 'Groupe Alpha',
      type_offre: 'premium',
      periodicite_paiement: 'mensuel',
      pallier_vise: 'p2',
      modele_statique_succes: 'standard',
      tarifs_palliers: { p1: 100, p2: 200 },
      paiement_initial: 49,
      email_facturation: 'facturation@test.co',
      adresse_facturation: '10 rue Exemple',
      siret_facturation: '12345678901234',
      conditions_paiement_defaut: '30 jours',
      mode_paiement_prefere: 'virement',
      vecteur_achat: 'direct',
      etablissements_en_facturation_groupe: 2,
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements_groupes');
    expect(mockFrom).toHaveBeenCalledWith('groupes_etablissements');
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
  });

  it('retourne null sur erreur de récupération du groupe_id et log l’erreur', async () => {
    const dbError = { message: 'x' };

    mockFrom.mockImplementation((table: string) => {
      const chain = createBuilder(async (currentTable, state) => {
        if (currentTable === 'etablissements_groupes' && state.filters['eq:etablissement_id'] === ETABLISSEMENT_ID) {
          return { data: null, error: dbError };
        }
        return { data: null, error: null };
      });

      return chain.setTable(table);
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result } = renderHook(() => useEtablissementGroupeId(ETABLISSEMENT_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
    expect(mockDebugError).toHaveBeenCalledWith('[useEtablissementGroupeId] Error:', dbError);
  });

  it('retourne null sur erreur de récupération des données de groupe et log l’erreur', async () => {
    const dbError = { message: 'x' };

    mockFrom.mockImplementation((table: string) => {
      const chain = createBuilder(async (currentTable, state) => {
        if (currentTable === 'groupes_etablissements' && state.filters['eq:id'] === GROUPE_ID) {
          return { data: null, error: dbError };
        }
        return { data: null, error: null };
      });

      return chain.setTable(table);
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result } = renderHook(() => useGroupeFacturationData(GROUPE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
    expect(mockDebugError).toHaveBeenCalledWith('[useGroupeFacturationData] Error fetching groupe:', dbError);
  });

  it('sauvegarde la configuration de facturation du groupe et invalide les caches attendus', async () => {
    let capturedBuilder: ReturnType<typeof createBuilder>['builder'] | null = null;

    mockFrom.mockImplementation((table: string) => {
      const chain = createBuilder(async (currentTable, state) => {
        if (
          currentTable === 'groupes_etablissements' &&
          state.operation === 'select' &&
          state.filters['eq:id'] === GROUPE_ID
        ) {
          return { data: UPDATE_RESULT, error: null };
        }
        return { data: null, error: null };
      });

      capturedBuilder = chain.builder;
      return chain.setTable(table);
    });

    const client = createQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const wrapper = createWrapper(client);

    const payload = {
      type_offre: 'enterprise',
      periodicite_paiement: 'annuel',
      pallier_vise: 'p3',
      modele_statique_succes: 'avance',
      tarifs_palliers: { p3: 500 },
      paiement_initial: 99,
      email_facturation: 'billing@test.co',
      adresse_facturation: '20 avenue Test',
      siret_facturation: '98765432109876',
      conditions_paiement_defaut: '45 jours',
      mode_paiement_prefere: 'prelevement',
      vecteur_achat: 'indirect',
    };

    const { result } = renderHook(() => useSaveGroupeFacturation(), { wrapper });

    await act(async () => {
      await result.current.saveGroupeFacturation(GROUPE_ID, payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('groupes_etablissements');
    expect(capturedBuilder?.update).toHaveBeenCalledWith({
      type_offre: 'enterprise',
      periodicite_paiement: 'annuel',
      pallier_vise: 'p3',
      modele_statique_succes: 'avance',
      tarifs_palliers: { p3: 500 },
      paiement_initial: 99,
      email_facturation: 'billing@test.co',
      adresse_facturation: '20 avenue Test',
      siret_facturation: '98765432109876',
      conditions_paiement_defaut: '45 jours',
      mode_paiement_prefere: 'prelevement',
      vecteur_achat: 'indirect',
    });
    expect(capturedBuilder?.eq).toHaveBeenCalledWith('id', GROUPE_ID);
    expect(capturedBuilder?.select).toHaveBeenCalledWith('id');
    expect(capturedBuilder?.maybeSingle).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['groupe-facturation', GROUPE_ID] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['groupe-etablissements'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['etablissement-modele-economique'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['facturation-etablissements'] });
  });

  it('propage une erreur si la mise à jour Supabase échoue', async () => {
    const dbError = { message: 'x' };

    mockFrom.mockImplementation((table: string) => {
      const chain = createBuilder(async (currentTable, state) => {
        if (
          currentTable === 'groupes_etablissements' &&
          state.operation === 'select' &&
          state.filters['eq:id'] === GROUPE_ID
        ) {
          return { data: null, error: dbError };
        }
        return { data: null, error: null };
      });

      return chain.setTable(table);
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result } = renderHook(() => useSaveGroupeFacturation(), { wrapper });

    await expect(result.current.saveGroupeFacturation(GROUPE_ID, { type_offre: 'premium' })).rejects.toEqual(dbError);
  });

  it('lève une erreur métier si la mise à jour est silencieusement ignorée', async () => {
    mockFrom.mockImplementation((table: string) => {
      const chain = createBuilder(async (currentTable, state) => {
        if (
          currentTable === 'groupes_etablissements' &&
          state.operation === 'select' &&
          state.filters['eq:id'] === GROUPE_ID
        ) {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      });

      return chain.setTable(table);
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result } = renderHook(() => useSaveGroupeFacturation(), { wrapper });

    await expect(result.current.saveGroupeFacturation(GROUPE_ID, { type_offre: 'premium' })).rejects.toThrow(
      "Échec de la mise à jour : vous n'avez peut-être pas les permissions nécessaires"
    );
  });
});