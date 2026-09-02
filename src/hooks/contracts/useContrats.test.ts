/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useContrats,
  useContrat,
  useContratAvenants,
  useContratAlertes,
  useCreateContrat,
  useUpdateContrat,
  useDeleteContrat,
  useCreateAvenant,
  useTraiterAlerte,
  useContratsKPIs,
} from "./useContrats";

const {
  AUTH_STATE,
  CONTRATS_ROWS,
  CONTRAT_SINGLE,
  AVENANTS_ROWS,
  ALERTES_ROWS,
  KPI_ROWS,
  INSERTED_CONTRAT,
  UPDATED_CONTRAT,
  INSERTED_AVENANT,
  sanitizePostgrestValueMock,
  toastSuccess,
  toastError,
  debugError,
  mockFrom,
  builderState,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const CONTRATS_ROWS = [
    {
      id: "c1",
      numero: "CTR-001",
      titre: "Contrat maintenance",
      client_nom: "Alpha",
      statut: "actif",
      type: "maintenance",
      etablissement_id: "e1",
      montant_annuel_ht: 1200,
      clauses_selectionnees: [],
      tags: ["urgent"],
      metadata: { source: "test" },
      etablissement: { id: "e1", nom: "Clinique A", ville: "Paris" },
      contact: { id: "ct1", nom: "Durand", prenom: "Alice" },
      commercial: { id: "p1", prenom: "Jean", nom: "Martin" },
    },
    {
      id: "c2",
      numero: "CTR-002",
      titre: "Contrat énergie",
      client_nom: "Beta",
      statut: "brouillon",
      type: "energie",
      etablissement_id: "e2",
      montant_annuel_ht: 800,
      clauses_selectionnees: [],
      tags: [],
      metadata: {},
      etablissement: { id: "e2", nom: "Site B", ville: "Lyon" },
      contact: { id: "ct2", nom: "Bernard", prenom: "Luc" },
      commercial: { id: "p2", prenom: "Lea", nom: "Petit" },
    },
  ];

  const CONTRAT_SINGLE = {
    id: "c1",
    numero: "CTR-001",
    titre: "Contrat maintenance",
    client_nom: "Alpha",
    statut: "actif",
    type: "maintenance",
    etablissement_id: "e1",
    metadata: { niveau: 1 },
    etablissement: { id: "e1", nom: "Clinique A", ville: "Paris" },
    contact: { id: "ct1", nom: "Durand", prenom: "Alice", email: "alice@example.fr" },
    commercial: { id: "p1", prenom: "Jean", nom: "Martin" },
  };

  const AVENANTS_ROWS = [
    {
      id: "a2",
      contrat_id: "c1",
      numero: 2,
      titre: "Extension",
      description: "Ajout service",
      modifications: { service: true },
      contenu_html: "<p>ok</p>",
      date_effet: "2026-01-01",
      date_signature: null,
      signature_url: null,
      signe_par: null,
      statut: "brouillon",
      created_by: "u1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "a1",
      contrat_id: "c1",
      numero: 1,
      titre: "Initial",
      description: "Base",
      modifications: {},
      contenu_html: "<p>base</p>",
      date_effet: "2025-01-01",
      date_signature: null,
      signature_url: null,
      signe_par: null,
      statut: "signe",
      created_by: "u1",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    },
  ];

  const ALERTES_ROWS = [
    {
      id: "al1",
      contrat_id: "c1",
      date_alerte: "2026-06-15",
      est_traitee: false,
      contrat: {
        id: "c1",
        numero: "CTR-001",
        titre: "Contrat maintenance",
        client_nom: "Alpha",
        statut: "actif",
      },
    },
    {
      id: "al2",
      contrat_id: "c2",
      date_alerte: "2026-06-20",
      est_traitee: true,
      contrat: {
        id: "c2",
        numero: "CTR-002",
        titre: "Contrat énergie",
        client_nom: "Beta",
        statut: "brouillon",
      },
    },
  ];

  const now = new Date();
  const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const KPI_ROWS = [
    { statut: "actif", montant_annuel_ht: 1000, date_fin: in10Days },
    { statut: "actif", montant_annuel_ht: 500, date_fin: in60Days },
    { statut: "en_attente_signature", montant_annuel_ht: 300, date_fin: null },
    { statut: "resilie", montant_annuel_ht: 200, date_fin: in10Days },
  ];

  const INSERTED_CONTRAT = {
    id: "c3",
    numero: "CTR-003",
    titre: "Nouveau contrat",
    created_by: "u1",
    clauses_selectionnees: [],
    tags: [],
    metadata: { foo: "bar" },
  };

  const UPDATED_CONTRAT = {
    id: "c1",
    titre: "Contrat modifié",
    metadata: { version: 2 },
  };

  const INSERTED_AVENANT = {
    id: "a3",
    contrat_id: "c1",
    numero: 3,
    titre: "Nouvel avenant",
    created_by: "u1",
    modifications: { prix: true },
  };

  const sanitizePostgrestValueMock = vi.fn((value: string) => value.replace(/[%']/g, ""));
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const debugError = vi.fn();
  const mockFrom = vi.fn();

  const builderState = {
    table: "",
    selectArg: undefined as string | undefined,
    insertArg: undefined as unknown,
    updateArg: undefined as unknown,
    deleteCalled: false,
    eqCalls: [] as Array<[string, unknown]>,
    orderCalls: [] as Array<[string, unknown]>,
    limitArg: undefined as number | undefined,
    orArg: undefined as string | undefined,
    resultQueue: [] as Array<{ data: unknown; error: { message: string } | null }>,
    nextResult: { data: null as unknown, error: null as { message: string } | null },
  };

  return {
    AUTH_STATE,
    CONTRATS_ROWS,
    CONTRAT_SINGLE,
    AVENANTS_ROWS,
    ALERTES_ROWS,
    KPI_ROWS,
    INSERTED_CONTRAT,
    UPDATED_CONTRAT,
    INSERTED_AVENANT,
    sanitizePostgrestValueMock,
    toastSuccess,
    toastError,
    debugError,
    mockFrom,
    builderState,
  };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizePostgrestValue: sanitizePostgrestValueMock,
}));

vi.mock("@/integrations/supabase/client", () => {
  const getNextResult = () => {
    if (builderState.resultQueue.length > 0) {
      return builderState.resultQueue.shift() as { data: unknown; error: { message: string } | null };
    }
    return builderState.nextResult;
  };

  const createBuilder = () => {
    const builder = {
      select: vi.fn((arg?: string) => {
        builderState.selectArg = arg;
        return builder;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        builderState.eqCalls.push([column, value]);
        return builder;
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn((column: string, options?: unknown) => {
        builderState.orderCalls.push([column, options]);
        return builder;
      }),
      limit: vi.fn((n: number) => {
        builderState.limitArg = n;
        return builder;
      }),
      or: vi.fn((value: string) => {
        builderState.orArg = value;
        return builder;
      }),
      insert: vi.fn((arg: unknown) => {
        builderState.insertArg = arg;
        return builder;
      }),
      update: vi.fn((arg: unknown) => {
        builderState.updateArg = arg;
        return builder;
      }),
      delete: vi.fn(() => {
        builderState.deleteCalled = true;
        return builder;
      }),
      single: vi.fn(async () => getNextResult()),
      maybeSingle: vi.fn(async () => getNextResult()),
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(getNextResult()).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(getNextResult()).catch(onRejected),
    };
    return builder;
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation((table: string) => {
        builderState.table = table;
        return createBuilder();
      }),
    },
  };
});

function resetBuilder() {
  builderState.table = "";
  builderState.selectArg = undefined;
  builderState.insertArg = undefined;
  builderState.updateArg = undefined;
  builderState.deleteCalled = false;
  builderState.eqCalls = [];
  builderState.orderCalls = [];
  builderState.limitArg = undefined;
  builderState.orArg = undefined;
  builderState.resultQueue = [];
  builderState.nextResult = { data: null, error: null };
}

function createWrapper(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, wrapper };
}

describe("useContrats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
  });

  it("charge puis retourne la liste filtrée des contrats avec recherche sanitizée", async () => {
    builderState.nextResult = { data: CONTRATS_ROWS, error: null };
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useContrats({
          statut: "actif",
          type: "maintenance",
          etablissement_id: "e1",
          search: "Alpha%'",
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("contrats");
    expect(builderState.eqCalls).toContainEqual(["statut", "actif"]);
    expect(builderState.eqCalls).toContainEqual(["type", "maintenance"]);
    expect(builderState.eqCalls).toContainEqual(["etablissement_id", "e1"]);
    expect(sanitizePostgrestValueMock).toHaveBeenCalledWith("Alpha%'");
    expect(builderState.orArg).toBe(
      "titre.ilike.%Alpha%,numero.ilike.%Alpha%,client_nom.ilike.%Alpha%"
    );
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].numero).toBe("CTR-001");
    expect(result.current.data?.[0].etablissement.nom).toBe("Clinique A");
  });

  it("passe en erreur quand la requête contrats échoue", async () => {
    builderState.nextResult = { data: null, error: { message: "x" } };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContrats(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("x");
  });
});

describe("useContrat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
  });

  it("retourne un contrat détaillé", async () => {
    builderState.nextResult = { data: CONTRAT_SINGLE, error: null };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContrat("c1"), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("contrats");
    expect(builderState.eqCalls).toContainEqual(["id", "c1"]);
    expect(result.current.data?.contact.email).toBe("alice@example.fr");
    expect(result.current.data?.commercial.nom).toBe("Martin");
  });

  it("passe en erreur quand la lecture du contrat échoue", async () => {
    builderState.nextResult = { data: null, error: { message: "x" } };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContrat("c1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("x");
  });

  it("ne lance pas la requête sans id", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContrat(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("useContratAvenants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
  });

  it("retourne les avenants d'un contrat triés par numéro", async () => {
    builderState.nextResult = { data: AVENANTS_ROWS, error: null };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContratAvenants("c1"), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("contrat_avenants");
    expect(builderState.eqCalls).toContainEqual(["contrat_id", "c1"]);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].numero).toBe(2);
    expect(result.current.data?.[1].statut).toBe("signe");
  });

  it("passe en erreur quand la lecture des avenants échoue", async () => {
    builderState.nextResult = { data: null, error: { message: "x" } };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContratAvenants("c1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("x");
  });
});

describe("useContratAlertes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
  });

  it("retourne les alertes et filtre les non traitées", async () => {
    builderState.nextResult = { data: ALERTES_ROWS, error: null };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContratAlertes({ nonTraiteesOnly: true }), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("contrat_alertes");
    expect(builderState.eqCalls).toContainEqual(["est_traitee", false]);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].contrat.numero).toBe("CTR-001");
  });

  it("passe en erreur quand la lecture des alertes échoue", async () => {
    builderState.nextResult = { data: null, error: { message: "x" } };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContratAlertes(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("x");
  });
});

describe("mutations contrats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
  });

  it("crée un contrat avec valeurs par défaut et invalide la liste", async () => {
    builderState.nextResult = { data: INSERTED_CONTRAT, error: null };
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateContrat(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        titre: "Nouveau contrat",
        metadata: { foo: "bar" },
      });
    });

    expect(mockFrom).toHaveBeenCalledWith("contrats");
    expect(builderState.insertArg).toEqual({
      titre: "Nouveau contrat",
      metadata: { foo: "bar" },
      created_by: "u1",
      clauses_selectionnees: [],
      tags: [],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contrats"] });
    expect(toastSuccess).toHaveBeenCalledWith("Contrat créé avec succès");
  });

  it("remonte une erreur de création contrat et trace l'erreur", async () => {
    builderState.nextResult = { data: null, error: { message: "x" } };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateContrat(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ titre: "Ko" })).rejects.toMatchObject({ message: "x" });
    });

    expect(debugError).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Erreur lors de la création du contrat");
  });

  it("met à jour un contrat et invalide liste + détail", async () => {
    builderState.nextResult = { data: UPDATED_CONTRAT, error: null };
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateContrat(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "c1",
        titre: "Contrat modifié",
        metadata: { version: 2 },
      });
    });

    expect(mockFrom).toHaveBeenCalledWith("contrats");
    expect(builderState.updateArg).toEqual({
      titre: "Contrat modifié",
      metadata: { version: 2 },
    });
    expect(builderState.eqCalls).toContainEqual(["id", "c1"]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contrats"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contrat", "c1"] });
    expect(toastSuccess).toHaveBeenCalledWith("Contrat mis à jour");
  });

  it("supprime un contrat puis invalide la liste", async () => {
    builderState.nextResult = { data: null, error: null };
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteContrat(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("c2");
    });

    expect(mockFrom).toHaveBeenCalledWith("contrats");
    expect(builderState.deleteCalled).toBe(true);
    expect(builderState.eqCalls).toContainEqual(["id", "c2"]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contrats"] });
    expect(toastSuccess).toHaveBeenCalledWith("Contrat supprimé");
  });

  it("passe en erreur lors de la suppression", async () => {
    builderState.nextResult = { data: null, error: { message: "x" } };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteContrat(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync("c2")).rejects.toMatchObject({ message: "x" });
    });

    expect(debugError).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Erreur lors de la suppression");
  });
});

describe("mutations avenants et alertes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
  });

  it("crée un avenant avec numéro suivant et invalide la requête liée", async () => {
    builderState.resultQueue = [
      { data: [{ numero: 2 }], error: null },
      { data: INSERTED_AVENANT, error: null },
    ];

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateAvenant(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        contrat_id: "c1",
        titre: "Nouvel avenant",
        modifications: { prix: true },
      });
    });

    expect(mockFrom).toHaveBeenCalledWith("contrat_avenants");
    expect(builderState.limitArg).toBe(1);
    expect(builderState.insertArg).toEqual({
      contrat_id: "c1",
      titre: "Nouvel avenant",
      modifications: { prix: true },
      numero: 3,
      created_by: "u1",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contrat-avenants", "c1"] });
    expect(toastSuccess).toHaveBeenCalledWith("Avenant créé avec succès");
  });

  it("marque une alerte comme traitée", async () => {
    builderState.nextResult = { data: null, error: null };
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTraiterAlerte(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("al1");
    });

    expect(mockFrom).toHaveBeenCalledWith("contrat_alertes");
    expect(builderState.updateArg).toMatchObject({
      est_traitee: true,
      traitee_par: "u1",
    });
    expect(typeof (builderState.updateArg as { traitee_le?: string }).traitee_le).toBe("string");
    expect(builderState.eqCalls).toContainEqual(["id", "al1"]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contrat-alertes"] });
    expect(toastSuccess).toHaveBeenCalledWith("Alerte marquée comme traitée");
  });

  it("passe en erreur lors du traitement d'alerte", async () => {
    builderState.nextResult = { data: null, error: { message: "x" } };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTraiterAlerte(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync("al1")).rejects.toMatchObject({ message: "x" });
    });

    expect(debugError).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Erreur lors du traitement de l'alerte");
  });
});

describe("useContratsKPIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
  });

  it("calcule les KPI métier à partir des contrats", async () => {
    builderState.nextResult = { data: KPI_ROWS, error: null };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContratsKPIs(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("contrats");
    expect(result.current.data).toEqual({
      totalActifs: 2,
      caAnnuelActif: 1500,
      enAttenteSignature: 1,
      expirantDans30Jours: 1,
    });
  });

  it("passe en erreur si la récupération des KPI échoue", async () => {
    builderState.nextResult = { data: null, error: { message: "x" } };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContratsKPIs(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("x");
  });
});