/// <reference types="vitest" />
/// <reference types="vite/client" />
/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";

const {
  PARTENAIRE_ID,
  SUGGESTIONS,
  toastSuccess,
  toastError,
  sanitizeSupabaseError,
  mockFrom,
  mockSelect,
  mockEq,
  mockNot,
  mockOrder,
  mockLimit,
  mockUpdate,
  mockInvoke,
  stableSelectResponse,
  stableUpdateResponse,
} = vi.hoisted(() => {
  const PARTENAIRE_ID = "p1";

  const SUGGESTIONS = [
    {
      id: "s1",
      action_type: "create_task",
      action_data: { title: "Relancer le partenaire" },
      confidence_score: 0.82,
      reason: "Email entrant",
      status: "pending",
      etablissement_id: "e1",
      partenaire_id: "p1",
      email_thread_id: "t1",
      reviewed_by: null,
      reviewed_at: null,
      created_at: "2025-01-01T10:00:00.000Z",
    },
    {
      id: "s2",
      action_type: "draft_email",
      action_data: { subject: "Proposition" },
      confidence_score: 0.74,
      reason: "Historique",
      status: "pending",
      etablissement_id: "e2",
      partenaire_id: "p2",
      email_thread_id: "t2",
      reviewed_by: null,
      reviewed_at: null,
      created_at: "2025-01-02T10:00:00.000Z",
    },
  ] as const;

  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const sanitizeSupabaseError = vi.fn((e: Error) => `sanitized:${e.message}`);

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockNot = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockUpdate = vi.fn();

  const mockInvoke = vi.fn();

  const stableSelectResponse: { current: { data: unknown; error: unknown } } = { current: { data: [], error: null } };
  const stableUpdateResponse: { current: { data?: unknown; error: unknown } } = { current: { error: null } };

  return {
    PARTENAIRE_ID,
    SUGGESTIONS,
    toastSuccess,
    toastError,
    sanitizeSupabaseError,
    mockFrom,
    mockSelect,
    mockEq,
    mockNot,
    mockOrder,
    mockLimit,
    mockUpdate,
    mockInvoke,
    stableSelectResponse,
    stableUpdateResponse,
  };
});

type QueryResult = { data: unknown; error: unknown };
type SupabaseBuilder = {
  select: (columns: string) => SupabaseBuilder;
  eq: (column: string, value: unknown) => SupabaseBuilder;
  not: (column: string, operator: string, value: unknown) => SupabaseBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseBuilder;
  limit: (count: number) => SupabaseBuilder;
  update: (values: Record<string, unknown>) => SupabaseBuilder;
  then: <TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ) => Promise<TResult1 | TResult2>;
  catch: <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null,
  ) => Promise<unknown | TResult>;
};

function makeThenable(getResponse: () => QueryResult) {
  const obj = {
    then: (onfulfilled?: ((value: QueryResult) => unknown) | null, onrejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(getResponse()).then(onfulfilled ?? undefined, onrejected ?? undefined),
    catch: (onrejected?: ((reason: unknown) => unknown) | null) => Promise.resolve(getResponse()).catch(onrejected ?? undefined),
  };
  return obj;
}

function createBuilder(getResponse: () => QueryResult): SupabaseBuilder {
  const builder: SupabaseBuilder = {
    select: (columns: string) => {
      mockSelect(columns);
      return builder;
    },
    eq: (column: string, value: unknown) => {
      mockEq(column, value);
      return builder;
    },
    not: (column: string, operator: string, value: unknown) => {
      mockNot(column, operator, value);
      return builder;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      mockOrder(column, options);
      return builder;
    },
    limit: (count: number) => {
      mockLimit(count);
      return builder;
    },
    update: (values: Record<string, unknown>) => {
      mockUpdate(values);
      return createBuilder(() => ({ data: stableUpdateResponse.current.data, error: stableUpdateResponse.current.error }));
    },
    then: ((onfulfilled?: ((value: QueryResult) => unknown) | null, onrejected?: ((reason: unknown) => unknown) | null) =>
      makeThenable(getResponse).then(onfulfilled ?? undefined, onrejected ?? undefined)) as SupabaseBuilder["then"],
    catch: ((onrejected?: ((reason: unknown) => unknown) | null) =>
      makeThenable(getResponse).catch(onrejected ?? undefined)) as SupabaseBuilder["catch"],
  };
  return builder;
}

vi.mock("@/lib/supabaseBrowser", () => {
  const from = (table: string) => {
    mockFrom(table);
    return createBuilder(() => ({ data: stableSelectResponse.current.data, error: stableSelectResponse.current.error }));
  };

  return {
    supabase: {
      from: vi.fn(from),
      functions: {
        invoke: mockInvoke,
      },
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError,
}));

import { usePartenaireAISuggestions } from "./usePartenaireAISuggestions";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function WrapperFactory({ queryClient, children }: { queryClient: QueryClient; children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePartenaireAISuggestions", () => {
  it("chargement -> succès: filtre par partenaireId et expose les suggestions", async () => {
    stableSelectResponse.current = { data: SUGGESTIONS, error: null };

    const queryClient = createQueryClient();

    const { result } = renderHook(() => usePartenaireAISuggestions(PARTENAIRE_ID), {
      wrapper: ({ children }) => React.createElement(WrapperFactory, { queryClient, children }),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.suggestions.length).toBe(2);
    });

    expect(mockFrom).toHaveBeenCalledWith("ai_suggested_actions");
    expect(mockSelect).toHaveBeenCalledWith(
      "id, action_type, action_data, confidence_score, reason, status, etablissement_id, partenaire_id, email_thread_id, reviewed_by, reviewed_at, created_at",
    );
    expect(mockEq).toHaveBeenCalledWith("status", "pending");
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(100);
    expect(mockEq).toHaveBeenCalledWith("partenaire_id", PARTENAIRE_ID);

    expect(result.current.suggestions[0]?.id).toBe("s1");
    expect(result.current.suggestions[0]?.action_type).toBe("create_task");
    expect(result.current.suggestions[1]?.id).toBe("s2");
    expect(result.current.suggestions[1]?.action_type).toBe("draft_email");
  });

  it("erreur: sans partenaireId applique not(partenaire_id is null) et remonte isError via throw", async () => {
    stableSelectResponse.current = { data: null, error: { message: "x" } };

    const queryClient = createQueryClient();

    const { result } = renderHook(() => usePartenaireAISuggestions(undefined), {
      wrapper: ({ children }) => React.createElement(WrapperFactory, { queryClient, children }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockNot).toHaveBeenCalledWith("partenaire_id", "is", null);
    expect(result.current.suggestions).toEqual([]);
    expect(queryClient.getQueryState(["partenaire-ai-suggestions", undefined])?.status).toBe("error");
  });

  it("approveSuggestion: invoke, toast success et invalidations", async () => {
    stableSelectResponse.current = { data: SUGGESTIONS, error: null };
    mockInvoke.mockResolvedValue({ data: { applied: true }, error: null });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => usePartenaireAISuggestions(PARTENAIRE_ID), {
      wrapper: ({ children }) => React.createElement(WrapperFactory, { queryClient, children }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.approveSuggestion("s1");
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("apply-ai-suggestion", { body: { suggestion_id: "s1" } });
      expect(toastSuccess).toHaveBeenCalledWith("Suggestion appliquée avec succès");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["partenaire-ai-suggestions"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["partenaires"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["partenaire-activities"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-drafts"] });
    });
  });

  it("rejectSuggestion: update + eq(id) puis toast success + invalidate; et en erreur appelle sanitizeSupabaseError + toast.error", async () => {
    stableSelectResponse.current = { data: SUGGESTIONS, error: null };
    stableUpdateResponse.current = { error: null };

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => usePartenaireAISuggestions(PARTENAIRE_ID), {
      wrapper: ({ children }) => React.createElement(WrapperFactory, { queryClient, children }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.rejectSuggestion("s2");
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("ai_suggested_actions");
      expect(mockUpdate).toHaveBeenCalledWith({
        status: "rejected",
        reviewed_at: expect.any(String) as unknown as string,
      });
      expect(mockEq).toHaveBeenCalledWith("id", "s2");
      expect(toastSuccess).toHaveBeenCalledWith("Suggestion rejetée");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["partenaire-ai-suggestions"] });
    });

    stableUpdateResponse.current = { error: new Error("update failed") };

    await act(async () => {
      result.current.rejectSuggestion("s1");
    });

    await waitFor(() => {
      expect(sanitizeSupabaseError).toHaveBeenCalledWith(expect.any(Error) as unknown as Error);
      expect(toastError).toHaveBeenCalledWith("sanitized:update failed");
    });
  });

  it("approveSuggestion: en erreur appelle sanitizeSupabaseError + toast.error", async () => {
    stableSelectResponse.current = { data: SUGGESTIONS, error: null };
    mockInvoke.mockResolvedValue({ data: null, error: new Error("invoke failed") });

    const queryClient = createQueryClient();

    const { result } = renderHook(() => usePartenaireAISuggestions(PARTENAIRE_ID), {
      wrapper: ({ children }) => React.createElement(WrapperFactory, { queryClient, children }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.approveSuggestion("s1");
    });

    await waitFor(() => {
      expect(sanitizeSupabaseError).toHaveBeenCalledWith(expect.any(Error) as unknown as Error);
      expect(toastError).toHaveBeenCalledWith("sanitized:invoke failed");
    });
  });
});