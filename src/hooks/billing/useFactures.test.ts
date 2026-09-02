// @vitest-environment jsdom
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFactures, useFactureDetail } from "./useFactures";

const {
  USER,
  FACTURES_ROWS,
  FACTURE_DETAIL,
  CREATED_FACTURE,
  UPDATED_FACTURE,
  CREATED_PAIEMENT,
  toastMock,
  sanitizeMock,
  debugWarnMock,
  mockFrom,
  mockInvoke,
  invalidateQueriesMock,
  builderMap,
} = vi.hoisted(() => {
  const USER = { id: "u1", email: "t@t.co" };

  const now = Date.now();
  const past = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  const future = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();

  const FACTURES_ROWS = [
    {
      id: "f1",
      statut: "brouillon",
      montant_ttc: 100,
      montant_paye: 20,
      date_echeance: past,
      client_nom: "Alpha",
      etablissement_id: "e1",
      created_at: "2024-01-10",
    },
    {
      id: "f2",
      statut: "payee",
      montant_ttc: 200,
      montant_paye: 200,
      date_echeance: past,
      client_nom: "Beta",
      etablissement_id: "e1",
      created_at: "2024-01-11",
    },
    {
      id: "f3",
      statut: "envoyee",
      montant_ttc: 50,
      montant_paye: 0,
      date_echeance: future,
      client_nom: "Gamma",
      etablissement_id: "e2",
      created_at: "2024-01-12",
    },
    {
      id: "f4",
      statut: "annulee",
      montant_ttc: 40,
      montant_paye: 0,
      date_echeance: past,
      client_nom: "Delta",
      etablissement_id: "e2",
      created_at: "2024-01-13",
    },
  ];

  const FACTURE_DETAIL = {
    id: "f1",
    statut: "brouillon",
    montant_ttc: 100,
    montant_paye: 20,
    date_echeance: past,
    client_nom: "Alpha",
    lignes: [
      {
        id: "l1",
        designation: "Service",
        quantite: 2,
        prix_unitaire_ht: 40,
      },
    ],
    paiements: [
      {
        id: "p1",
        montant: 20,
        mode_paiement: "virement",
      },
    ],
  };

  const CREATED_FACTURE = {
    id: "f-new",
    client_nom: "Nouveau client",
    commercial_id: "u1",
  };

  const UPDATED_FACTURE = {
    id: "f1",
    statut: "payee",
    montant_paye: 100,
  };

  const CREATED_PAIEMENT = {
    id: "p-new",
    facture_id: "f1",
    montant: 30,
  };

  const toastMock = vi.fn();
  const sanitizeMock = vi.fn((error: Error | { message?: string }) => error.message ?? "sanitized");
  const debugWarnMock = vi.fn();
  const mockInvoke = vi.fn(async () => ({ data: { ok: true }, error: null }));
  const mockFrom = vi.fn();
  const invalidateQueriesMock = vi.fn();

  const builderMap = {
    factures: {
      result: { data: FACTURES_ROWS, error: null } as { data: unknown; error: { message: string } | null },
      selectResult: undefined as undefined | { data: unknown; error: { message: string } | null },
      singleResult: undefined as undefined | { data: unknown; error: { message: string } | null },
      maybeSingleResult: { data: FACTURE_DETAIL, error: null } as { data: unknown; error: { message: string } | null },
      insertResult: undefined as undefined | { data: unknown; error: { message: string } | null },
      updateResult: undefined as undefined | { data: unknown; error: { message: string } | null },
      deleteResult: { data: null, error: null } as { data: unknown; error: { message: string } | null },
      eqCalls: [] as Array<[string, unknown]>,
      orderCalls: [] as Array<[string, unknown]>,
      insertCalls: [] as unknown[],
      updateCalls: [] as unknown[],
      deleteCalls: 0,
      selectCalls: [] as unknown[],
    },
    factures_lignes: {
      result: { data: null, error: null } as { data: unknown; error: { message: string } | null },
      insertResult: { data: null, error: null } as { data: unknown; error: { message: string } | null },
      insertCalls: [] as unknown[],
    },
    paiements_factures: {
      result: { data: null, error: null } as { data: unknown; error: { message: string } | null },
      singleResult: { data: CREATED_PAIEMENT, error: null } as { data: unknown; error: { message: string } | null },
      insertCalls: [] as unknown[],
    },
  };

  return {
    USER,
    FACTURES_ROWS,
    FACTURE_DETAIL,
    CREATED_FACTURE,
    UPDATED_FACTURE,
    CREATED_PAIEMENT,
    toastMock,
    sanitizeMock,
    debugWarnMock,
    mockFrom,
    mockInvoke,
    invalidateQueriesMock,
    builderMap,
  };
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = (table: keyof typeof builderMap) => {
    const state = builderMap[table];

    const builder = {
      select: vi.fn((...args: unknown[]) => {
        if ("selectCalls" in state && Array.isArray(state.selectCalls)) state.selectCalls.push(args);
        if ("selectResult" in state && state.selectResult !== undefined) {
          state.result = state.selectResult;
        }
        return builder;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        if ("eqCalls" in state && Array.isArray(state.eqCalls)) state.eqCalls.push([column, value]);
        return builder;
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn((column: string, options?: unknown) => {
        if ("orderCalls" in state && Array.isArray(state.orderCalls)) state.orderCalls.push([column, options]);
        return builder;
      }),
      limit: vi.fn(() => builder),
      insert: vi.fn((payload: unknown) => {
        if ("insertCalls" in state && Array.isArray(state.insertCalls)) state.insertCalls.push(payload);
        if ("insertResult" in state && state.insertResult !== undefined) {
          state.result = state.insertResult;
        }
        return builder;
      }),
      update: vi.fn((payload: unknown) => {
        if ("updateCalls" in state && Array.isArray(state.updateCalls)) state.updateCalls.push(payload);
        if ("updateResult" in state && state.updateResult !== undefined) {
          state.result = state.updateResult;
        }
        return builder;
      }),
      delete: vi.fn(() => {
        if ("deleteCalls" in state && typeof state.deleteCalls === "number") state.deleteCalls += 1;
        if ("deleteResult" in state && state.deleteResult !== undefined) {
          state.result = state.deleteResult;
        }
        return builder;
      }),
      single: vi.fn(async () => {
        if ("singleResult" in state && state.singleResult !== undefined) return state.singleResult;
        return state.result;
      }),
      maybeSingle: vi.fn(async () => {
        if ("maybeSingleResult" in state && state.maybeSingleResult !== undefined) return state.maybeSingleResult;
        return state.result;
      }),
      then: (
        onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(state.result).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(state.result).catch(onRejected),
    };

    return builder;
  };

  mockFrom.mockImplementation((table: keyof typeof builderMap) => createBuilder(table));

  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: mockInvoke,
      },
    },
  };
});

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: sanitizeMock,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    warn: debugWarnMock,
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: USER,
    session: { user: USER },
    isLoading: false,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    QueryClientProvider({ client: queryClient, children });
}

function resetBuilders() {
  builderMap.factures.result = { data: FACTURES_ROWS, error: null };
  builderMap.factures.selectResult = undefined;
  builderMap.factures.singleResult = undefined;
  builderMap.factures.maybeSingleResult = { data: FACTURE_DETAIL, error: null };
  builderMap.factures.insertResult = undefined;
  builderMap.factures.updateResult = undefined;
  builderMap.factures.deleteResult = { data: null, error: null };
  builderMap.factures.eqCalls = [];
  builderMap.factures.orderCalls = [];
  builderMap.factures.insertCalls = [];
  builderMap.factures.updateCalls = [];
  builderMap.factures.deleteCalls = 0;
  builderMap.factures.selectCalls = [];

  builderMap.factures_lignes.result = { data: null, error: null };
  builderMap.factures_lignes.insertResult = { data: null, error: null };
  builderMap.factures_lignes.insertCalls = [];

  builderMap.paiements_factures.result = { data: null, error: null };
  builderMap.paiements_factures.singleResult = { data: CREATED_PAIEMENT, error: null };
  builderMap.paiements_factures.insertCalls = [];

  mockFrom.mockClear();
  mockInvoke.mockClear();
  toastMock.mockClear();
  sanitizeMock.mockClear();
  debugWarnMock.mockClear();
  invalidateQueriesMock.mockClear();
}

describe("useFactures", () => {
  beforeEach(() => {
    resetBuilders();
  });

  it("charge les factures, applique les filtres et calcule les KPIs métier", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useFactures({ statut: "envoyee", etablissementId: "e1" }), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith("factures");
    expect(builderMap.factures.orderCalls).toEqual([["created_at", { ascending: false }]]);
    expect(builderMap.factures.eqCalls).toContainEqual(["statut", "envoyee"]);
    expect(builderMap.factures.eqCalls).toContainEqual(["etablissement_id", "e1"]);

    expect(result.current.factures).toHaveLength(4);
    expect(result.current.factures[0].client_nom).toBe("Alpha");
    expect(result.current.kpis.totalFacture).toBe(390);
    expect(result.current.kpis.totalPaye).toBe(220);
    expect(result.current.kpis.totalEnAttente).toBe(130);
    expect(result.current.kpis.nbFacturesEnRetard).toBe(1);
    expect(result.current.kpis.totalEnRetard).toBe(80);
    expect(result.current.error).toBeNull();
  });

  it("passe en erreur si la requête liste échoue", async () => {
    builderMap.factures.result = { data: null, error: { message: "liste cassée" } };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useFactures(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.factures).toEqual([]);
    expect(result.current.error?.message).toBe("liste cassée");
  });

  it("crée une facture avec lignes, injecte created_by/commercial_id et synchronise la trésorerie", async () => {
    builderMap.factures.singleResult = { data: CREATED_FACTURE, error: null };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useFactures(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const payload = {
      client_nom: "Nouveau client",
      etablissement_id: "e1",
      date_emission: "2024-02-01",
      lignes: [
        { designation: "Prestation A", quantite: 1, ordre: 5 },
        { designation: "Prestation B", quantite: 2 },
      ],
    };

    await act(async () => {
      await result.current.createFacture(payload);
    });

    expect(builderMap.factures.insertCalls[0]).toEqual({
      client_nom: "Nouveau client",
      client_adresse: undefined,
      client_email: undefined,
      client_telephone: undefined,
      client_siret: undefined,
      etablissement_id: "e1",
      groupe_id: undefined,
      partenaire_id: undefined,
      contact_id: undefined,
      date_emission: "2024-02-01",
      date_echeance: undefined,
      conditions_paiement: undefined,
      notes_internes: undefined,
      notes_client: undefined,
      devis_id: undefined,
      numero_bon_commande: undefined,
      created_by: "u1",
      commercial_id: "u1",
    });

    expect(builderMap.factures_lignes.insertCalls[0]).toEqual([
      { designation: "Prestation A", quantite: 1, ordre: 5, facture_id: "f-new" },
      { designation: "Prestation B", quantite: 2, facture_id: "f-new", ordre: 1 },
    ]);

    expect(mockInvoke).toHaveBeenCalledWith("sync-factures-tresorerie", {
      body: { factureId: "f-new", action: "create" },
    });

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["factures"] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["tresorerie-revenus"] });
    expect(toastMock).toHaveBeenCalledWith({ title: "Facture créée avec succès" });
  });

  it("affiche un toast d'erreur si la création échoue", async () => {
    builderMap.factures.singleResult = { data: null, error: { message: "insert impossible" } };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useFactures(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.createFacture({ client_nom: "X" })).rejects.toMatchObject({
      message: "insert impossible",
    });

    expect(sanitizeMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      title: "Erreur lors de la création de la facture",
      description: "insert impossible",
      variant: "destructive",
    });
  });

  it("met à jour une facture et déclenche la synchronisation", async () => {
    builderMap.factures.singleResult = { data: UPDATED_FACTURE, error: null };
    builderMap.factures.updateResult = { data: UPDATED_FACTURE, error: null };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useFactures(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateFacture({ id: "f1", statut: "payee", montant_paye: 100 });
    });

    expect(builderMap.factures.updateCalls[0]).toEqual({ statut: "payee", montant_paye: 100 });
    expect(builderMap.factures.eqCalls).toContainEqual(["id", "f1"]);
    expect(mockInvoke).toHaveBeenCalledWith("sync-factures-tresorerie", {
      body: { factureId: "f1", action: "update" },
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["factures"] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["tresorerie-revenus"] });
    expect(toastMock).toHaveBeenCalledWith({ title: "Facture mise à jour" });
  });

  it("supprime une facture", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFactures(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteFacture("f3");
    });

    expect(builderMap.factures.deleteCalls).toBe(1);
    expect(builderMap.factures.eqCalls).toContainEqual(["id", "f3"]);
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["factures"] });
    expect(toastMock).toHaveBeenCalledWith({ title: "Facture supprimée" });
  });

  it("ajoute un paiement avec created_by", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFactures(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.addPaiement({
        facture_id: "f1",
        montant: 30,
        date_paiement: "2024-02-10",
        mode_paiement: "virement",
        reference: "REF1",
      });
    });

    expect(builderMap.paiements_factures.insertCalls[0]).toEqual({
      facture_id: "f1",
      montant: 30,
      date_paiement: "2024-02-10",
      mode_paiement: "virement",
      reference: "REF1",
      created_by: "u1",
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["factures"] });
    expect(toastMock).toHaveBeenCalledWith({ title: "Paiement enregistré" });
  });
});

describe("useFactureDetail", () => {
  beforeEach(() => {
    resetBuilders();
  });

  it("retourne le détail d'une facture quand un id est fourni", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useFactureDetail("f1"), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith("factures");
    expect(builderMap.factures.eqCalls).toContainEqual(["id", "f1"]);
    expect(result.current.data).toEqual(FACTURE_DETAIL);
    expect(result.current.data?.lignes).toHaveLength(1);
    expect(result.current.data?.paiements?.[0].montant).toBe(20);
  });

  it("retourne une erreur si la requête détail échoue", async () => {
    builderMap.factures.maybeSingleResult = { data: null, error: { message: "detail cassé" } };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useFactureDetail("f1"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("detail cassé");
  });

  it("n'exécute pas la requête sans id", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useFactureDetail(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});