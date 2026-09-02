// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useQuickClassification } from "./useQuickClassification";

const {
  AUTH_STATE,
  toastMock,
  debugLog,
  debugWarn,
  debugError,
  mockFrom,
  THREAD_ID,
  RELATED_THREAD_ID,
  EMAILS_QUERY_DATA,
  RELATED_MESSAGES_DATA,
  maybeSingleNoExisting,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  toastMock: vi.fn(),
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
  mockFrom: vi.fn(),
  THREAD_ID: "thread-1",
  RELATED_THREAD_ID: "thread-2",
  EMAILS_QUERY_DATA: [
    {
      from_address: "External@Acme.com",
      to_addresses: ["internal@marque.fr", "contact@acme.com", "friend@gmail.com"],
      cc_addresses: ["partner@partner.io", "EXTERNAL@acme.com"],
    },
  ],
  RELATED_MESSAGES_DATA: [{ thread_id: "thread-2" }],
  maybeSingleNoExisting: { data: null, error: null },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    log: debugLog,
    warn: debugWarn,
    error: debugError,
  },
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  toast: toastMock,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/lib/internalEmailConfig", () => ({
  normalizeEmail: (email: string | undefined) => (email ? email.trim().toLowerCase() : ""),
  isMarqueEmail: (email: string) => email.endsWith("@marque.fr"),
  extractEmailDomain: (email: string) => {
    const at = email.indexOf("@");
    return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
  },
  isGenericEmailDomain: (domain: string) => ["gmail.com", "yahoo.com", "outlook.com"].includes(domain),
}));

type BuilderResult = {
  data: unknown;
  error: { message: string } | null;
};

function createBuilder(resolver: (table: string, state: Record<string, unknown>) => BuilderResult | Promise<BuilderResult>) {
  let tableName = "";
  const state: Record<string, unknown> = {
    selectArg: undefined,
    updateArg: undefined,
    insertArg: undefined,
    upsertArg: undefined,
    upsertOptions: undefined,
    filters: [],
  };

  const builder: any = {
    select: vi.fn((arg?: string) => {
      state.selectArg = arg;
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      (state.filters as unknown[]).push({ type: "eq", column, value });
      return builder;
    }),
    neq: vi.fn((column: string, value: unknown) => {
      (state.filters as unknown[]).push({ type: "neq", column, value });
      return builder;
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn((column: string, value: unknown) => {
      (state.filters as unknown[]).push({ type: "in", column, value });
      return builder;
    }),
    is: vi.fn((column: string, value: unknown) => {
      (state.filters as unknown[]).push({ type: "is", column, value });
      return builder;
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    update: vi.fn((arg: unknown) => {
      state.updateArg = arg;
      return builder;
    }),
    insert: vi.fn((arg: unknown) => {
      state.insertArg = arg;
      return builder;
    }),
    upsert: vi.fn((arg: unknown, options?: unknown) => {
      state.upsertArg = arg;
      state.upsertOptions = options;
      return Promise.resolve(resolver(tableName, state));
    }),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(resolver(tableName, state))),
    maybeSingle: vi.fn(() => Promise.resolve(resolver(tableName, state))),
    then: (onFulfilled: (value: BuilderResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolver(tableName, state)).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(resolver(tableName, state)).catch(onRejected),
    __setTable: (table: string) => {
      tableName = table;
      return builder;
    },
  };

  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient, invalidateSpy };
}

describe("useQuickClassification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expose un état initial non chargé puis classifie avec succès, invalide le cache, notifie et propage les mappings", async () => {
    const resolver = vi.fn(async (table: string, state: Record<string, unknown>) => {
      if (table === "email_threads" && state.updateArg && (state.filters as Array<{ type: string; column: string; value: unknown }>).some((f) => f.type === "eq" && f.column === "id" && f.value === THREAD_ID)) {
        return { data: null, error: null };
      }

      if (table === "email_messages" && state.selectArg === "from_address, to_addresses, cc_addresses") {
        return { data: EMAILS_QUERY_DATA, error: null };
      }

      if (table === "email_domain_mappings" && state.selectArg === "id") {
        return maybeSingleNoExisting;
      }

      if (table === "email_messages" && state.selectArg === "thread_id") {
        return { data: RELATED_MESSAGES_DATA, error: null };
      }

      if (table === "email_threads" && state.updateArg && (state.filters as Array<{ type: string; column: string; value: unknown }>).some((f) => f.type === "in" && f.column === "id")) {
        return { data: null, error: null };
      }

      return { data: null, error: null };
    });

    mockFrom.mockImplementation((table: string) => createBuilder(resolver).__setTable(table));

    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useQuickClassification(), { wrapper });

    expect(result.current.isClassifying).toBe(false);

    await act(async () => {
      result.current.classifyThread({
        threadId: THREAD_ID,
        etablissementId: "eta-1",
        etablissementNom: "Clinique Alpha",
      });
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Classification réussie",
        description: "Thread classifié dans Clinique Alpha",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-threads"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-thread", THREAD_ID] });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("email_specific_mappings");
    });

    const emailSpecificCalls = resolver.mock.calls.filter(([table]) => table === "email_specific_mappings");
    expect(emailSpecificCalls.length).toBe(4);

    const upsertPayloads = emailSpecificCalls.map(([, state]) => state.upsertArg as Record<string, unknown>);
    expect(upsertPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email_address: "external@acme.com",
          etablissement_id: "eta-1",
          groupe_id: null,
          partenaire_id: null,
          niveau_mapping: "etablissement",
          source: "manual_quick",
        }),
        expect.objectContaining({
          email_address: "contact@acme.com",
          etablissement_id: "eta-1",
        }),
        expect.objectContaining({
          email_address: "partner@partner.io",
          etablissement_id: "eta-1",
        }),
        expect.objectContaining({
          email_address: "friend@gmail.com",
          etablissement_id: "eta-1",
        }),
      ]),
    );

    const domainInsertCalls = resolver.mock.calls.filter(([table, state]) => table === "email_domain_mappings" && state.insertArg);
    expect(domainInsertCalls).toHaveLength(2);
    const insertedDomains = domainInsertCalls.map(([, state]) => (state.insertArg as Record<string, unknown>).domain);
    expect(insertedDomains).toEqual(expect.arrayContaining(["acme.com", "partner.io"]));
    expect(insertedDomains).not.toContain("gmail.com");

    const propagationCall = resolver.mock.calls.find(
      ([table, state]) =>
        table === "email_threads" &&
        !!state.updateArg &&
        (state.filters as Array<{ type: string; column: string; value: unknown }>).some((f) => f.type === "in" && f.column === "id"),
    );
    expect(propagationCall).toBeTruthy();
    if (propagationCall) {
      const [, state] = propagationCall;
      expect(state.updateArg).toEqual({ etablissement_id: "eta-1" });
      expect(state.filters).toEqual(
        expect.arrayContaining([
          { type: "in", column: "id", value: [RELATED_THREAD_ID] },
          { type: "is", column: "etablissement_id", value: null },
          { type: "is", column: "partenaire_id", value: null },
          { type: "is", column: "groupe_id", value: null },
        ]),
      );
    }

    expect(debugLog).toHaveBeenCalledWith("✅ Quick classification propagated to 1 related threads");
    expect(result.current.isClassifying).toBe(false);
  });

  it("passe par l'état pending pendant la mutation", async () => {
    let resolveUpdate: ((value: BuilderResult) => void) | null = null;

    const resolver = vi.fn((table: string, state: Record<string, unknown>) => {
      if (table === "email_threads" && state.updateArg && (state.filters as Array<{ type: string; column: string; value: unknown }>).some((f) => f.type === "eq")) {
        return new Promise<BuilderResult>((resolve) => {
          resolveUpdate = resolve;
        });
      }
      return { data: [], error: null };
    });

    mockFrom.mockImplementation((table: string) => createBuilder(resolver).__setTable(table));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useQuickClassification(), { wrapper });

    act(() => {
      result.current.classifyThread({
        threadId: THREAD_ID,
        groupeId: "grp-1",
        groupeNom: "Groupe Nord",
      });
    });

    await waitFor(() => {
      expect(result.current.isClassifying).toBe(true);
    });

    await act(async () => {
      if (resolveUpdate) {
        resolveUpdate({ data: null, error: null });
      }
    });

    await waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "Classification réussie",
      description: "Thread classifié dans le groupe Groupe Nord",
    });
  });

  it("gère une erreur Supabase et affiche un toast destructif", async () => {
    const resolver = vi.fn(async (table: string, state: Record<string, unknown>) => {
      if (table === "email_threads" && state.updateArg) {
        return { data: null, error: { message: "x" } };
      }
      return { data: null, error: null };
    });

    mockFrom.mockImplementation((table: string) => createBuilder(resolver).__setTable(table));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useQuickClassification(), { wrapper });

    await act(async () => {
      result.current.classifyThread({
        threadId: THREAD_ID,
        partenaireId: "part-1",
        partenaireNom: "Partenaire Sud",
      });
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Erreur",
        description: "Impossible de classifier le thread",
        variant: "destructive",
      });
    });

    expect(debugError).toHaveBeenCalledWith("Erreur lors de la classification:", { message: "x" });
    expect(mockFrom).toHaveBeenCalledWith("email_threads");

    const threadUpdateCall = resolver.mock.calls.find(([table]) => table === "email_threads");
    expect(threadUpdateCall).toBeTruthy();
    if (threadUpdateCall) {
      const [, state] = threadUpdateCall;
      expect(state.updateArg).toEqual({ partenaire_id: "part-1" });
      expect(state.filters).toEqual(expect.arrayContaining([{ type: "eq", column: "id", value: THREAD_ID }]));
    }
  });
})