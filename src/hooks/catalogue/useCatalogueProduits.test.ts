import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCatalogueProduits } from "./useCatalogueProduits";

const {
  ROWS_ACTIVE,
  ROWS_ALL,
  INSERTED_ROW,
  UPDATED_ROW,
  TOAST_FN,
  state,
  mockFrom,
  mockToast,
  mockSanitize,
  resetState,
} = vi.hoisted(() => {
  type CatalogueProduitRow = {
    id: string;
    code: string;
    nom: string;
    description: string | null;
    type: string;
    prix_unitaire_ht: number;
    taux_tva: number;
    unite: string | null;
    est_actif: boolean;
    categorie: string | null;
    recurrence: string | null;
    prix_min_ht: number | null;
    prix_max_ht: number | null;
    remise_max_pct: number | null;
    notes_internes: string | null;
    ordre_affichage: number;
    created_at: string;
    updated_at: string;
  };

  const ROWS_ACTIVE: CatalogueProduitRow[] = [
    {
      id: "p1",
      code: "A1",
      nom: "Alpha",
      description: "Desc A",
      type: "service",
      prix_unitaire_ht: 10,
      taux_tva: 20,
      unite: "u",
      est_actif: true,
      categorie: "cat1",
      recurrence: null,
      prix_min_ht: null,
      prix_max_ht: null,
      remise_max_pct: 0,
      notes_internes: null,
      ordre_affichage: 0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "p2",
      code: "B1",
      nom: "Beta",
      description: null,
      type: "produit",
      prix_unitaire_ht: 25,
      taux_tva: 10,
      unite: "u",
      est_actif: true,
      categorie: null,
      recurrence: null,
      prix_min_ht: 20,
      prix_max_ht: 30,
      remise_max_pct: 5,
      notes_internes: "note",
      ordre_affichage: 1,
      created_at: "2024-02-01T00:00:00Z",
      updated_at: "2024-02-01T00:00:00Z",
    },
  ];

  const ROWS_ALL: CatalogueProduitRow[] = [
    ...ROWS_ACTIVE,
    {
      id: "p3",
      code: "C1",
      nom: "Gamma",
      description: null,
      type: "service",
      prix_unitaire_ht: 5,
      taux_tva: 20,
      unite: "u",
      est_actif: false,
      categorie: null,
      recurrence: null,
      prix_min_ht: null,
      prix_max_ht: null,
      remise_max_pct: null,
      notes_internes: null,
      ordre_affichage: 2,
      created_at: "2024-03-01T00:00:00Z",
      updated_at: "2024-03-01T00:00:00Z",
    },
  ];

  const INSERTED_ROW: CatalogueProduitRow = {
    id: "pNew",
    code: "N1",
    nom: "Nouveau",
    description: null,
    type: "service",
    prix_unitaire_ht: 12,
    taux_tva: 20,
    unite: "u",
    est_actif: true,
    categorie: null,
    recurrence: null,
    prix_min_ht: null,
    prix_max_ht: null,
    remise_max_pct: null,
    notes_internes: null,
    ordre_affichage: 3,
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  };

  const UPDATED_ROW: CatalogueProduitRow = {
    ...ROWS_ACTIVE[0],
    nom: "Alpha+",
    updated_at: "2024-05-01T00:00:00Z",
  };

  const TOAST_FN = vi.fn();

  const state = {
    listData: ROWS_ACTIVE as unknown[],
    listError: null as { message: string } | null,

    insertData: INSERTED_ROW as unknown,
    insertError: null as { message: string } | null,

    updateData: UPDATED_ROW as unknown,
    updateError: null as { message: string } | null,

    deleteError: null as { message: string } | null,
    archiveError: null as { message: string } | null,

    reorderErrorsById: new Map<string, { message: string } | null>(),
  };

  const resetState = () => {
    state.listData = ROWS_ACTIVE as unknown[];
    state.listError = null;

    state.insertData = INSERTED_ROW as unknown;
    state.insertError = null;

    state.updateData = UPDATED_ROW as unknown;
    state.updateError = null;

    state.deleteError = null;
    state.archiveError = null;

    state.reorderErrorsById.clear();
  };

  const makeThenable = (exec: () => Promise<unknown>) => ({
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => exec().then(onFulfilled, onRejected),
    catch: (onRejected: (e: unknown) => unknown) => exec().catch(onRejected),
  });

  type Ctx = {
    table?: string;
    action?: "select" | "insert" | "update" | "delete";
    selectCols?: string;
    single?: boolean;
    maybeSingle?: boolean;
    payload?: unknown;
    filters: { type: "eq" | "gte" | "lte" | "in"; col: string; val: unknown }[];
    orders: { col: string; opts?: { ascending?: boolean } }[];
    limitCount?: number;
  };

  const createBuilder = () => {
    const ctx: Ctx = {
      filters: [],
      orders: [],
    };

    const exec = async () => {
      if (ctx.table !== "catalogue_produits") return { data: null, error: { message: "unknown table" } };

      if (ctx.action === "select") {
        return { data: state.listData, error: state.listError };
      }

      if (ctx.action === "insert") {
        if (state.insertError) return { data: null, error: state.insertError };
        if (ctx.single) return { data: state.insertData, error: null };
        return { data: [state.insertData], error: null };
      }

      if (ctx.action === "update") {
        const idFilter = ctx.filters.find((f) => f.type === "eq" && f.col === "id")?.val;
        if (typeof idFilter === "string") {
          const reorderErr = state.reorderErrorsById.get(idFilter) ?? null;
          if (reorderErr) return { data: null, error: reorderErr };
        }

        if (state.updateError) return { data: null, error: state.updateError };
        if (state.archiveError) return { data: null, error: state.archiveError };
        if (ctx.single) return { data: state.updateData, error: null };
        return { data: [state.updateData], error: null };
      }

      if (ctx.action === "delete") {
        if (state.deleteError) return { error: state.deleteError };
        return { error: null };
      }

      return { data: null, error: { message: "unknown action" } };
    };

    const chain = {
      _ctx: ctx,
      _state: state,
      select: vi.fn((cols?: string) => {
        ctx.action = ctx.action ?? "select";
        ctx.selectCols = cols;
        return chain;
      }),
      insert: vi.fn((payload: unknown) => {
        ctx.action = "insert";
        ctx.payload = payload;
        return chain;
      }),
      update: vi.fn((payload: unknown) => {
        ctx.action = "update";
        ctx.payload = payload;
        return chain;
      }),
      delete: vi.fn(() => {
        ctx.action = "delete";
        return chain;
      }),
      eq: vi.fn((col: string, val: unknown) => {
        ctx.filters.push({ type: "eq", col, val });
        return chain;
      }),
      gte: vi.fn((col: string, val: unknown) => {
        ctx.filters.push({ type: "gte", col, val });
        return chain;
      }),
      lte: vi.fn((col: string, val: unknown) => {
        ctx.filters.push({ type: "lte", col, val });
        return chain;
      }),
      in: vi.fn((col: string, val: unknown) => {
        ctx.filters.push({ type: "in", col, val });
        return chain;
      }),
      order: vi.fn((col: string, opts?: { ascending?: boolean }) => {
        ctx.orders.push({ col, opts });
        return chain;
      }),
      limit: vi.fn((count: number) => {
        ctx.limitCount = count;
        return chain;
      }),
      single: vi.fn(() => {
        ctx.single = true;
        return makeThenable(exec);
      }),
      maybeSingle: vi.fn(() => {
        ctx.maybeSingle = true;
        return makeThenable(exec);
      }),
      then: ((onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => exec().then(onFulfilled, onRejected)) as unknown,
      catch: ((onRejected: (e: unknown) => unknown) => exec().catch(onRejected)) as unknown,
    };

    return chain;
  };

  const mockFrom = vi.fn((table: string) => {
    const b = createBuilder();
    b._ctx.table = table;
    return b;
  });

  const mockToast = vi.fn(() => ({ toast: TOAST_FN }));
  const mockSanitize = vi.fn((e: unknown) => {
    if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
    return "Erreur";
  });

  return { ROWS_ACTIVE, ROWS_ALL, INSERTED_ROW, UPDATED_ROW, TOAST_FN, state, mockFrom, mockToast, mockSanitize, resetState };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: mockToast,
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitize,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe("useCatalogueProduits", () => {
  it("charge puis retourne les produits (filtre actifs par défaut) et groupés par type", async () => {
    resetState();
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useCatalogueProduits(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.produits.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(Object.keys(result.current.produitsByType).sort()).toEqual(["produit", "service"]);
    expect(result.current.produitsByType.service.map((p) => p.id)).toEqual(["p1"]);
    expect(result.current.produitsByType.produit.map((p) => p.id)).toEqual(["p2"]);

    expect(mockFrom).toHaveBeenCalledWith("catalogue_produits");
    const builder = mockFrom.mock.results[0]?.value as unknown as {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
    };
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith("est_actif", true);
    expect(builder.order).toHaveBeenCalledWith("ordre_affichage", { ascending: true });
  });

  it("avec showInactive=true ne filtre pas est_actif et retourne aussi les inactifs", async () => {
    resetState();
    state.listData = ROWS_ALL as unknown[];

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useCatalogueProduits(true), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.produits.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);

    const builder = mockFrom.mock.results.at(-1)?.value as unknown as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.eq).not.toHaveBeenCalledWith("est_actif", true);
  });

  it("met error quand supabase renvoie une erreur", async () => {
    resetState();
    state.listError = { message: "boom" };

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useCatalogueProduits(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect((result.current.error as { message?: string } | null)?.message).toBe("boom");
  });

  it("createProduit: appelle insert avec le payload, invalide la query et toast succès", async () => {
    resetState();
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useCatalogueProduits(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = mockFrom.mock.calls.length;

    const payload = {
      code: "N1",
      nom: "Nouveau",
      description: null,
      type: "service",
      prix_unitaire_ht: 12,
      taux_tva: 20,
      unite: "u",
      est_actif: true,
      categorie: null,
      recurrence: null,
      prix_min_ht: null,
      prix_max_ht: null,
      remise_max_pct: null,
      notes_internes: null,
      ordre_affichage: 3,
    };

    await act(async () => {
      const created = await result.current.createProduit(payload);
      expect((created as { id?: string } | null)?.id).toBe(INSERTED_ROW.id);
    });

    const builder = mockFrom.mock.results[before]?.value as unknown as {
      insert: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
    };

    expect(builder.insert).toHaveBeenCalledWith(payload);
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.single).toHaveBeenCalledTimes(1);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["catalogue_produits"] });
    expect(TOAST_FN).toHaveBeenCalledWith({ title: "Produit créé avec succès" });
  });

  it("updateProduit: appelle update+eq(id) avec les updates, puis toast succès", async () => {
    resetState();
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useCatalogueProduits(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = mockFrom.mock.calls.length;

    await act(async () => {
      const updated = await result.current.updateProduit({ id: "p1", nom: "Alpha+" });
      expect((updated as { nom?: string } | null)?.nom).toBe("Alpha+");
    });

    const builder = mockFrom.mock.results[before]?.value as unknown as {
      update: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
    };

    expect(builder.update).toHaveBeenCalledWith({ nom: "Alpha+" });
    expect(builder.eq).toHaveBeenCalledWith("id", "p1");
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.single).toHaveBeenCalledTimes(1);

    expect(TOAST_FN).toHaveBeenCalledWith({ title: "Produit mis à jour" });
  });

  it("deleteProduit: appelle delete+eq(id) puis toast succès", async () => {
    resetState();
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useCatalogueProduits(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = mockFrom.mock.calls.length;

    await act(async () => {
      await result.current.deleteProduit("p2");
    });

    const builder = mockFrom.mock.results[before]?.value as unknown as {
      delete: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };

    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith("id", "p2");
    expect(TOAST_FN).toHaveBeenCalledWith({ title: "Produit supprimé" });
  });

  it("duplicateProduit: insère une copie avec code suffixé et nom modifié, puis toast succès", async () => {
    resetState();
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useCatalogueProduits(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = mockFrom.mock.calls.length;

    await act(async () => {
      const created = await result.current.duplicateProduit("p1");
      expect((created as { id?: string } | null)?.id).toBe(INSERTED_ROW.id);
    });

    const builder = mockFrom.mock.results[before]?.value as unknown as {
      insert: ReturnType<typeof vi.fn>;
    };

    const insertedArg = builder.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedArg.code).toBe("A1-COPY");
    expect(insertedArg.nom).toBe("Alpha (copie)");
    expect(insertedArg).not.toHaveProperty("id");
    expect(insertedArg).not.toHaveProperty("created_at");
    expect(insertedArg).not.toHaveProperty("updated_at");

    expect(TOAST_FN).toHaveBeenCalledWith({ title: "Produit dupliqué" });
  });

  it("archiveProduit: update est_actif inverse de archive, toast selon archive", async () => {
    resetState();
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useCatalogueProduits(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before1 = mockFrom.mock.calls.length;

    await act(async () => {
      await result.current.archiveProduit({ id: "p1", archive: true });
    });

    const builder1 = mockFrom.mock.results[before1]?.value as unknown as {
      update: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };

    expect(builder1.update).toHaveBeenCalledWith({ est_actif: false });
    expect(builder1.eq).toHaveBeenCalledWith("id", "p1");
    expect(TOAST_FN).toHaveBeenCalledWith({ title: "Produit archivé" });

    const before2 = mockFrom.mock.calls.length;

    await act(async () => {
      await result.current.archiveProduit({ id: "p1", archive: false });
    });

    const builder2 = mockFrom.mock.results[before2]?.value as unknown as {
      update: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };

    expect(builder2.update).toHaveBeenCalledWith({ est_actif: true });
    expect(builder2.eq).toHaveBeenCalledWith("id", "p1");
    expect(TOAST_FN).toHaveBeenCalledWith({ title: "Produit réactivé" });
  });

  it("reorderProduits: met à jour ordre_affichage pour chaque id (idx) et invalide", async () => {
    resetState();
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useCatalogueProduits(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = mockFrom.mock.calls.length;

    await act(async () => {
      await result.current.reorderProduits(["p2", "p1"]);
    });

    const b1 = mockFrom.mock.results[before]?.value as unknown as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };
    const b2 = mockFrom.mock.results[before + 1]?.value as unknown as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };

    expect(b1.update).toHaveBeenCalledWith({ ordre_affichage: 0 });
    expect(b1.eq).toHaveBeenCalledWith("id", "p2");

    expect(b2.update).toHaveBeenCalledWith({ ordre_affichage: 1 });
    expect(b2.eq).toHaveBeenCalledWith("id", "p1");

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["catalogue_produits"] });
  });

  it("onError: createProduit affiche un toast destructive avec message sanitizé", async () => {
    resetState();
    state.insertError = { message: "insert failed" };

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useCatalogueProduits(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const payload = {
      code: "X1",
      nom: "X",
      description: null,
      type: "service",
      prix_unitaire_ht: 1,
      taux_tva: 20,
      unite: "u",
      est_actif: true,
      categorie: null,
      recurrence: null,
      prix_min_ht: null,
      prix_max_ht: null,
      remise_max_pct: null,
      notes_internes: null,
      ordre_affichage: 9,
    };

    await act(async () => {
      await expect(result.current.createProduit(payload)).rejects.toMatchObject({ message: "insert failed" });
    });

    expect(mockSanitize).toHaveBeenCalled();

    const lastCall = TOAST_FN.mock.calls.at(-1)?.[0] as { title?: string; description?: string; variant?: string } | undefined;
    expect(lastCall?.title).toBe("Erreur lors de la création");
    expect(lastCall?.description).toBe("insert failed");
    expect(lastCall?.variant).toBe("destructive");
  });
});