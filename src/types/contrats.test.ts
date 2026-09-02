import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { ROW_CONTRAT, ERROR_RESP, mockFrom, builder, setMaybeSingleSuccess, setMaybeSingleError, setInsertResponse, lastInsertPayload, clearMockCalls } = vi.hoisted(() => {
  const now = new Date().toISOString();
  const ROW_CONTRAT = {
    id: 'c1',
    numero: null,
    titre: 'Contrat de test',
    etablissement_id: null,
    groupe_id: null,
    partenaire_id: null,
    contact_id: null,
    template_id: null,
    devis_id: null,
    client_nom: 'Client Test',
    client_adresse: null,
    client_siret: null,
    client_representant: null,
    type: 'licence',
    statut: 'brouillon',
    date_emission: now,
    date_debut: null,
    date_fin: null,
    date_signature: null,
    date_resiliation: null,
    reconduction_tacite: false,
    preavis_jours: 0,
    duree_initiale_mois: 12,
    duree_renouvellement_mois: 12,
    alerte_renouvellement_envoyee: false,
    montant_annuel_ht: 1200,
    montant_mensuel_ht: 100,
    remise_pourcent: null,
    conditions_paiement: null,
    contenu_html: null,
    clauses_selectionnees: [],
    conditions_particulieres: null,
    signature_provider: null,
    signature_external_id: null,
    signature_url: null,
    signature_status: null,
    signe_par: null,
    notes_internes: null,
    tags: [],
    metadata: {},
    created_by: null,
    commercial_id: null,
    created_at: now,
    updated_at: now,
    etablissement: null,
    contact: null,
    commercial: null,
    template: null,
    avenants: []
  } as const;

  const ERROR_RESP = { message: 'erreur_contrat_mock' } as const;

  // Mutable internal state for stable functions
  let maybeSingleResp: { data: unknown; error: unknown } = { data: ROW_CONTRAT, error: null };
  let thenResp: { data: unknown; error: unknown } = { data: ROW_CONTRAT, error: null };
  let insertResp: { data: unknown; error: unknown } = { data: [ROW_CONTRAT], error: null };
  let _lastInsertPayload: unknown = null;

  const builder = {
    select: vi.fn(() => {
      // .select usually doesn't change the resolved payload for maybeSingle; keep chainable
      return builder;
    }),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn((payload?: unknown) => {
      _lastInsertPayload = payload ?? null;
      // after an insert, most clients will return created rows when awaited; set thenResp to current insertResp
      thenResp = insertResp;
      return builder;
    }),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: ROW_CONTRAT, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve(maybeSingleResp)),
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(thenResp).then(onFulfilled);
    },
    catch: vi.fn(() => builder)
  };

  const mockFrom = vi.fn(() => builder);

  function setMaybeSingleSuccess() {
    maybeSingleResp = { data: ROW_CONTRAT, error: null };
    thenResp = { data: ROW_CONTRAT, error: null };
  }

  function setMaybeSingleError() {
    maybeSingleResp = { data: null, error: ERROR_RESP };
    thenResp = { data: null, error: ERROR_RESP };
  }

  function setInsertResponse(resp: { data: unknown; error: unknown }) {
    insertResp = resp;
    thenResp = resp;
  }

  function clearMockCalls() {
    mockFrom.mockClear();
    builder.select.mockClear();
    builder.eq.mockClear();
    builder.maybeSingle.mockClear();
    builder.single.mockClear();
    builder.insert.mockClear();
  }

  return {
    ROW_CONTRAT,
    ERROR_RESP,
    mockFrom,
    builder,
    setMaybeSingleSuccess,
    setMaybeSingleError,
    setInsertResponse,
    lastInsertPayload: () => _lastInsertPayload,
    clearMockCalls
  };
});

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom
    }
  };
});

import { supabase } from '@/integrations/supabase/client';
import * as contrats from './contrats';

describe('module contrats - constantes et intégration supabase mockée', () => {
  function createWrapper() {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    });
    // Return without JSX to avoid TSX parsing issues in .ts test files
    return ({ children }: { children?: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children);
  }

  beforeEach(() => {
    // restore default successful responses and clear call history
    setMaybeSingleSuccess();
    setInsertResponse({ data: [ROW_CONTRAT], error: null });
    clearMockCalls();
  });

  it('exporte les labels et couleurs attendus pour les statuts et types', () => {
    expect(contrats.CONTRAT_STATUT_LABELS.signe).toBe('Signé');
    expect(contrats.CONTRAT_STATUT_LABELS.en_attente_signature).toBe('En attente de signature');
    expect(contrats.CONTRAT_STATUT_COLORS.actif).toContain('bg-green-100');
    expect(contrats.CONTRAT_TYPE_LABELS.licence).toBe('Licence');
    expect(contrats.CONTRAT_TYPE_COLORS.formation).toContain('bg-emerald-100');
    expect(Array.isArray(contrats.CLAUSE_CATEGORIES)).toBe(true);
    expect(contrats.CLAUSE_CATEGORIES).toContain('RGPD');
    expect(Object.keys(contrats.CONTRAT_STATUT_LABELS).length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(contrats.CONTRAT_TYPE_LABELS).length).toBeGreaterThanOrEqual(8);
  });

  it('hook de fetch simulé : état loading puis succès avec données métier', async () => {
    // Hook de test qui utilise le client supabase mocké
    function useFetchContrat(id: string) {
      const [state, setState] = React.useState({
        data: null as unknown,
        error: null as unknown,
        isLoading: true,
        isError: false
      });

      React.useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            const res = await supabase.from('contrats').select('*').eq('id', id).maybeSingle();
            if (!mounted) return;
            if (res.error) {
              setState({ data: null, error: res.error, isLoading: false, isError: true });
            } else {
              setState({ data: res.data, error: null, isLoading: false, isError: false });
            }
          } catch (err) {
            if (!mounted) return;
            setState({ data: null, error: { message: String(err) }, isLoading: false, isError: true });
          }
        })();
        return () => {
          mounted = false;
        };
      }, [id]);

      return state;
    }

    const wrapper = createWrapper();

    const { result } = renderHook(() => useFetchContrat(ROW_CONTRAT.id), { wrapper });

    // initial state loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Data must match the hoisted constant (stable reference properties)
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).not.toBeNull();
    expect((result.current.data as Record<string, unknown>).id).toBe(ROW_CONTRAT.id);
    expect((result.current.data as Record<string, unknown>).titre).toBe(ROW_CONTRAT.titre);
    expect((result.current.data as Record<string, unknown>).type).toBe(ROW_CONTRAT.type);

    // Supabase client must have been called with the right table name and chain methods invoked
    expect(mockFrom).toHaveBeenCalledWith('contrats');
    expect(builder.select).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', ROW_CONTRAT.id);
    expect(builder.maybeSingle).toHaveBeenCalled();
  });

  it("hook de fetch simulé : gestion d'erreur retournée par supabase", async () => {
    // Switch the maybeSingle implementation to return an error (stable via hoisted setter)
    setMaybeSingleError();

    function useFetchContrat(id: string) {
      const [state, setState] = React.useState({
        data: null as unknown,
        error: null as unknown,
        isLoading: true,
        isError: false
      });

      React.useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            const res = await supabase.from('contrats').select('*').eq('id', id).maybeSingle();
            if (!mounted) return;
            if (res.error) {
              setState({ data: null, error: res.error, isLoading: false, isError: true });
            } else {
              setState({ data: res.data, error: null, isLoading: false, isError: false });
            }
          } catch (err) {
            if (!mounted) return;
            setState({ data: null, error: { message: String(err) }, isLoading: false, isError: true });
          }
        })();
        return () => {
          mounted = false;
        };
      }, [id]);

      return state;
    }

    const wrapper = createWrapper();

    const { result } = renderHook(() => useFetchContrat(ROW_CONTRAT.id), { wrapper });

    // initial loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
    expect((result.current.error as { message: string }).message).toBe(ERROR_RESP.message);

    // Ensure supabase was invoked for the same table
    expect(mockFrom).toHaveBeenCalledWith('contrats');
    expect(builder.select).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', ROW_CONTRAT.id);
    expect(builder.maybeSingle).toHaveBeenCalled();
  });

  it("simule une mutation insert et vérifie l'appel avec les bons payloads", async () => {
    // Prepare created row and set insert response via hoisted setter (stable)
    const createdRow = { ...ROW_CONTRAT, id: 'c2', titre: 'Contrat créé' };
    setInsertResponse({ data: [createdRow], error: null });

    // Simple hook to perform mutation
    function useCreateContrat(payload: Record<string, unknown>) {
      const [state, setState] = React.useState({
        data: null as unknown,
        error: null as unknown,
        isLoading: false
      });
      const create = React.useCallback(async () => {
        setState(s => ({ ...s, isLoading: true }));
        try {
          const res = await supabase.from('contrats').insert(payload).select();
          // builder.then resolves to the configured insert response
          setState({ data: res.data, error: res.error, isLoading: false });
        } catch (err) {
          setState({ data: null, error: { message: String(err) }, isLoading: false });
        }
      }, [payload]);
      return { ...state, create };
    }

    const wrapper = createWrapper();
    const payload = { titre: 'Contrat créé', client_nom: 'Client X', type: 'licence' };

    const { result } = renderHook(() => useCreateContrat(payload), { wrapper });

    await act(async () => {
      // call the create function which performs the supabase insert chain
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (result.current as any).create();
    });

    // Assert supabase .from was used for correct table and insert called with payload
    expect(mockFrom).toHaveBeenCalledWith('contrats');
    expect(builder.insert).toHaveBeenCalledWith(payload);

    // Verify the payload recorded by the hoisted mock matches what we sent
    expect(lastInsertPayload()).toEqual(payload);

    // After mutation, state should reflect the created row array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.current as any).isLoading).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.current as any).error).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.current as any).data).toEqual([createdRow]);
  });
});