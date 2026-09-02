/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCreateEntityMutations } from "./useCreateEntityMutations";

const {
  AUTH_STATE,
  mockSanitizeSupabaseError,
  mockFrom,
  stableBuilder,
  etablissementSuccess,
  partenaireSuccess,
  groupeSuccess,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const mockSanitizeSupabaseError = vi.fn((error: unknown) =>
    error ? { message: (error as { message?: string }).message ?? "unknown" } : null
  );

  const etablissementSuccess = {
    id: "etab-1",
    nom: "Clinique Test",
    ville: "Paris",
    region: "Paris",
    type: "CH",
    statut: "Prospect",
    logo_url: null,
  };

  const partenaireSuccess = {
    id: "part-1",
    nom: "Partenaire Test",
    ville: "Lyon",
    type_partenaire: "Intégrateur",
    logo_url: "logo.png",
  };

  const groupeSuccess = {
    id: "grp-1",
    nom: "Groupe Test",
    type: "Groupe hospitalier",
    logo_url: null,
  };

  type BuilderResult = { data: unknown; error: { message: string } | null };

  const stableBuilder = {
    table: "",
    _result: { data: null, error: null } as BuilderResult,
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  stableBuilder.select.mockImplementation(() => stableBuilder);
  stableBuilder.eq.mockImplementation(() => stableBuilder);
  stableBuilder.gte.mockImplementation(() => stableBuilder);
  stableBuilder.lte.mockImplementation(() => stableBuilder);
  stableBuilder.in.mockImplementation(() => stableBuilder);
  stableBuilder.order.mockImplementation(() => stableBuilder);
  stableBuilder.limit.mockImplementation(() => stableBuilder);
  stableBuilder.insert.mockImplementation(() => stableBuilder);
  stableBuilder.update.mockImplementation(() => stableBuilder);
  stableBuilder.delete.mockImplementation(() => stableBuilder);
  stableBuilder.single.mockImplementation(() => Promise.resolve(stableBuilder._result));
  stableBuilder.maybeSingle.mockImplementation(() => Promise.resolve(stableBuilder._result));
  stableBuilder.then.mockImplementation((onFulfilled?: (value: BuilderResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(stableBuilder._result).then(onFulfilled, onRejected)
  );
  stableBuilder.catch.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(stableBuilder._result).catch(onRejected)
  );

  const mockFrom = vi.fn((table: string) => {
    stableBuilder.table = table;
    return stableBuilder;
  });

  return {
    AUTH_STATE,
    mockSanitizeSupabaseError,
    mockFrom,
    stableBuilder,
    etablissementSuccess,
    partenaireSuccess,
    groupeSuccess,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe("useCreateEntityMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stableBuilder.table = "";
    stableBuilder._result = { data: null, error: null };
    stableBuilder.select.mockImplementation(() => stableBuilder);
    stableBuilder.eq.mockImplementation(() => stableBuilder);
    stableBuilder.gte.mockImplementation(() => stableBuilder);
    stableBuilder.lte.mockImplementation(() => stableBuilder);
    stableBuilder.in.mockImplementation(() => stableBuilder);
    stableBuilder.order.mockImplementation(() => stableBuilder);
    stableBuilder.limit.mockImplementation(() => stableBuilder);
    stableBuilder.insert.mockImplementation(() => stableBuilder);
    stableBuilder.update.mockImplementation(() => stableBuilder);
    stableBuilder.delete.mockImplementation(() => stableBuilder);
    stableBuilder.single.mockImplementation(() => Promise.resolve(stableBuilder._result));
    stableBuilder.maybeSingle.mockImplementation(() => Promise.resolve(stableBuilder._result));
    stableBuilder.then.mockImplementation((onFulfilled?: (value: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(stableBuilder._result).then(onFulfilled, onRejected)
    );
    stableBuilder.catch.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(stableBuilder._result).catch(onRejected)
    );
    mockSanitizeSupabaseError.mockImplementation((error: unknown) =>
      error ? { message: (error as { message?: string }).message ?? "unknown" } : null
    );
  });

  it("crée un établissement, expose isCreating pendant la mutation et mappe les champs métier attendus", async () => {
    const wrapper = createWrapper();
    let resolveSingle: ((value: { data: unknown; error: { message: string } | null }) => void) | undefined;

    stableBuilder.single.mockImplementation(
      () =>
        new Promise<{ data: unknown; error: { message: string } | null }>((resolve) => {
          resolveSingle = resolve;
        })
    );

    const { result } = renderHook(() => useCreateEntityMutations(), { wrapper });

    expect(result.current.isCreating).toBe(false);
    expect(result.current.error).toBeNull();

    const payload = {
      nom: "Clinique Test",
      ville: "Paris",
      logo_url: null,
    };

    let mutationPromise: Promise<unknown> | undefined;

    await act(async () => {
      mutationPromise = result.current.createEntity("etablissement", payload);
    });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("etablissements");
    expect(stableBuilder.insert).toHaveBeenCalledTimes(1);

    const insertedArg = stableBuilder.insert.mock.calls[0]?.[0] as Array<{
      nom: string;
      ville: string;
      region: string;
      type: string;
      statut: string;
      adresse: string;
      code_postal: string;
      slug: string;
      logo_url: string | null | undefined;
      date_prise_contact: string;
    }>;

    expect(insertedArg).toEqual([
      expect.objectContaining({
        nom: "Clinique Test",
        ville: "Paris",
        region: "Paris",
        type: "CH",
        statut: "Prospect",
        adresse: "",
        code_postal: "",
        slug: "",
        logo_url: null,
      }),
    ]);
    expect(insertedArg[0]?.date_prise_contact).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await act(async () => {
      if (resolveSingle) {
        resolveSingle({ data: etablissementSuccess, error: null });
      }
      if (mutationPromise) {
        await mutationPromise;
      }
    });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(false);
    });
    expect(result.current.error).toBeNull();
  });

  it("crée un partenaire avec les valeurs fournies", async () => {
    const wrapper = createWrapper();
    stableBuilder._result = { data: partenaireSuccess, error: null };

    const { result } = renderHook(() => useCreateEntityMutations(), { wrapper });

    let created: unknown;
    await act(async () => {
      created = await result.current.createEntity("partenaire", {
        nom: "Partenaire Test",
        ville: "Lyon",
        type: "Intégrateur",
        logo_url: "logo.png",
      });
    });

    expect(mockFrom).toHaveBeenCalledWith("partenaires");
    expect(stableBuilder.insert).toHaveBeenCalledWith({
      nom: "Partenaire Test",
      ville: "Lyon",
      type_partenaire: "Intégrateur",
      logo_url: "logo.png",
    });
    expect(created).toEqual(partenaireSuccess);
    expect(result.current.error).toBeNull();
    expect(result.current.isCreating).toBe(false);
  });

  it("crée un groupe avec les valeurs par défaut attendues", async () => {
    const wrapper = createWrapper();
    stableBuilder._result = { data: groupeSuccess, error: null };

    const { result } = renderHook(() => useCreateEntityMutations(), { wrapper });

    let created: unknown;
    await act(async () => {
      created = await result.current.createEntity("groupe", {
        nom: "Groupe Test",
        logo_url: null,
      });
    });

    expect(mockFrom).toHaveBeenCalledWith("groupes_etablissements");
    expect(stableBuilder.insert).toHaveBeenCalledWith({
      nom: "Groupe Test",
      type: "Groupe hospitalier",
      logo_url: null,
    });
    expect(created).toEqual(groupeSuccess);
    expect(result.current.isCreating).toBe(false);
  });

  it("utilise les valeurs par défaut métier pour établissement quand ville et type sont absents", async () => {
    const wrapper = createWrapper();
    stableBuilder._result = { data: etablissementSuccess, error: null };

    const { result } = renderHook(() => useCreateEntityMutations(), { wrapper });

    await act(async () => {
      await result.current.createEntity("etablissement", {
        nom: "Clinique Sans Ville",
      });
    });

    expect(mockFrom).toHaveBeenCalledWith("etablissements");
    const insertedArg = stableBuilder.insert.mock.calls[0]?.[0] as Array<{
      nom: string;
      ville: string;
      region: string;
      type: string;
      statut: string;
    }>;
    expect(insertedArg[0]).toEqual(
      expect.objectContaining({
        nom: "Clinique Sans Ville",
        ville: "",
        region: "France",
        type: "CH",
        statut: "Prospect",
      })
    );
  });

  it("expose une erreur sanitizée quand la création échoue", async () => {
    const wrapper = createWrapper();
    const dbError = { message: "x" };
    stableBuilder._result = { data: null, error: dbError };

    const { result } = renderHook(() => useCreateEntityMutations(), { wrapper });

    await act(async () => {
      await expect(
        result.current.createEntity("partenaire", {
          nom: "Erreur Partenaire",
          ville: "Nice",
        })
      ).rejects.toEqual(dbError);
    });

    await waitFor(() => {
      expect(result.current.error).toEqual({ message: "x" });
    });

    expect(mockFrom).toHaveBeenCalledWith("partenaires");
    expect(stableBuilder.insert).toHaveBeenCalledWith({
      nom: "Erreur Partenaire",
      ville: "Nice",
      type_partenaire: "Éditeur de logiciels",
      logo_url: undefined,
    });
    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(result.current.isCreating).toBe(false);
  });
});