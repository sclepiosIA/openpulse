/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useKanbanTaskMutation } from "./useKanbanTaskMutation";

const {
  toastMock,
  sanitizeSupabaseErrorMock,
  mockFrom,
  updateMock,
  eqMock,
  successResponse,
  errorResponse,
} = vi.hoisted(() => {
  const success = { data: null, error: null };
  const failure = { data: null, error: { message: "x" } };

  const state = {
    current: success as { data: null; error: null | { message: string } },
  };

  const builder = {
    update: vi.fn(() => builder),
    eq: vi.fn(() => Promise.resolve(state.current)),
    then: (onFulfilled: (value: typeof success | typeof failure) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(state.current).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(state.current).catch(onRejected),
  };

  return {
    toastMock: vi.fn(),
    sanitizeSupabaseErrorMock: vi.fn((error: { message?: string }) => error.message ?? "unknown"),
    mockFrom: vi.fn(() => builder),
    updateMock: builder.update,
    eqMock: builder.eq,
    successResponse: () => {
      state.current = success;
    },
    errorResponse: () => {
      state.current = failure;
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return { Wrapper, queryClient, invalidateQueriesSpy };
}

describe("useKanbanTaskMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    successResponse();
  });

  it("expose un état initial de chargement inactif", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useKanbanTaskMutation(), { wrapper: Wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("met à jour une tâche, invalide la liste des tâches et affiche un toast de succès", async () => {
    successResponse();
    const { Wrapper, invalidateQueriesSpy } = createWrapper();
    const { result } = renderHook(() => useKanbanTaskMutation(), { wrapper: Wrapper });

    const payload = {
      id: "task-1",
      data: {
        statut: "done",
        ordre: 3,
      },
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith("taches");
    expect(updateMock).toHaveBeenCalledWith(payload.data);
    expect(eqMock).toHaveBeenCalledWith("id", payload.id);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["taches"] });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Tâche déplacée avec succès",
    });
  });

  it("passe en erreur et affiche un toast destructif avec le message sanitizé si Supabase échoue", async () => {
    errorResponse();
    sanitizeSupabaseErrorMock.mockReturnValueOnce("message nettoyé");

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useKanbanTaskMutation(), { wrapper: Wrapper });

    const payload = {
      id: "task-2",
      data: {
        statut: "blocked",
      },
    };

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toEqual({ message: "x" });
    });

    expect(mockFrom).toHaveBeenCalledWith("taches");
    expect(updateMock).toHaveBeenCalledWith(payload.data);
    expect(eqMock).toHaveBeenCalledWith("id", payload.id);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith({ message: "x" });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Erreur",
      description: "message nettoyé",
      variant: "destructive",
    });
  });
});