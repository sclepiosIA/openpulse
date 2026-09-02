/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useManualEmailClassification } from "./useManualEmailClassification";

const {
  invokeMock,
  mockFrom,
  toastSuccess,
  toastError,
  navigateMock,
  sanitizeMock,
  debugLog,
  debugError,
  QUERY_RESULT,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  mockFrom: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  navigateMock: vi.fn(),
  sanitizeMock: vi.fn((error: unknown) => {
    if (error instanceof Error) return `sanitized:${error.message}`;
    return "sanitized:unknown";
  }),
  debugLog: vi.fn(),
  debugError: vi.fn(),
  QUERY_RESULT: { data: null, error: null },
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => QUERY_RESULT),
    maybeSingle: vi.fn(async () => QUERY_RESULT),
    then: (onFulfilled: (value: typeof QUERY_RESULT) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(QUERY_RESULT).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(QUERY_RESULT).catch(onRejected),
    finally: (onFinally?: () => void) =>
      Promise.resolve(QUERY_RESULT).finally(onFinally),
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => builder),
      functions: {
        invoke: invokeMock,
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

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: sanitizeMock,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    log: debugLog,
    error: debugError,
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

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient, invalidateSpy };
}

describe("useManualEmailClassification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exécute une classification rapide avec succès, retourne les valeurs métier et invalide les queries", async () => {
    invokeMock.mockResolvedValue({
      data: {
        matched: 3,
        suggested: 2,
        hors: 1,
        interne: 4,
        processed: 10,
        remaining: 7,
        completed: false,
      },
      error: null,
    });

    const { Wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useManualEmailClassification(), {
      wrapper: Wrapper,
    });

    expect(result.current.isPending).toBe(false);

    let mutationResult:
      | {
          matched: number;
          suggested: number;
          hors: number;
          interne: number;
          total: number;
          remaining?: number;
          completed?: boolean;
          timedOut?: boolean;
        }
      | undefined;

    await act(async () => {
      mutationResult = await result.current.mutateAsync({ batchSize: 25 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("auto-match-emails", {
      body: { batchSize: 25 },
    });

    expect(mutationResult).toEqual({
      matched: 3,
      suggested: 2,
      hors: 1,
      interne: 4,
      total: 10,
      remaining: 7,
      completed: false,
    });

    expect(result.current.data).toEqual({
      matched: 3,
      suggested: 2,
      hors: 1,
      interne: 4,
      total: 10,
      remaining: 7,
      completed: false,
    });

    expect(toastSuccess).toHaveBeenCalledTimes(1);
    const successCall = toastSuccess.mock.calls[0];
    expect(successCall[0]).toContain("Classification effectuée (10 traités)");
    expect(successCall[0]).toContain("✅ 3 emails attribués");
    expect(successCall[0]).toContain("💡 2 suggestions créées");
    expect(successCall[0]).toContain("🏠 1 hors établissement");
    expect(successCall[0]).toContain("🏢 4 internes");
    expect(successCall[1]).toMatchObject({
      duration: 8000,
      action: {
        label: "Voir les suggestions",
      },
    });

    const options = successCall[1] as {
      action?: { onClick?: () => void };
    };

    await act(async () => {
      options.action?.onClick?.();
    });

    expect(navigateMock).toHaveBeenCalledWith("/emails?tab=suggestions");

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-threads"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-classification-stats"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-suggestions-pending"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-domain-mappings"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["unclassified-domains"] });
    expect(invalidateSpy).toHaveBeenCalledTimes(5);
  });

  it("exécute la classification complète sur plusieurs passes, agrège les compteurs et appelle onProgress", async () => {
    vi.useFakeTimers();

    invokeMock
      .mockResolvedValueOnce({
        data: {
          matched: 1,
          suggested: 2,
          hors: 0,
          interne: 1,
          processed: 4,
          remaining: 3,
          completed: false,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          matched: 2,
          suggested: 1,
          hors: 1,
          interne: 0,
          processed: 3,
          remaining: 0,
          completed: true,
        },
        error: null,
      });

    const onProgress = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useManualEmailClassification(), {
      wrapper: Wrapper,
    });

    const mutationPromise = act(async () =>
      result.current.mutateAsync({
        processAll: true,
        batchSize: 50,
        onProgress,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    const finalResult = await mutationPromise;

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock).toHaveBeenNthCalledWith(1, "auto-match-emails", {
      body: { batchSize: 50 },
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "auto-match-emails", {
      body: { batchSize: 50 },
    });

    expect(finalResult).toEqual({
      matched: 3,
      suggested: 3,
      hors: 1,
      interne: 1,
      total: 7,
      completed: true,
    });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        current: 4,
        total: 7,
        matched: 1,
        suggested: 2,
        elapsed: expect.any(Number),
      }),
    );
    expect(onProgress).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        current: 7,
        total: 7,
        matched: 3,
        suggested: 3,
        elapsed: expect.any(Number),
      }),
    );

    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess.mock.calls[0][0]).toContain("🎉 Classification complète terminée !");
    expect(toastSuccess.mock.calls[0][0]).toContain("✅ 3 emails attribués");
    expect(toastSuccess.mock.calls[0][0]).toContain("💡 3 suggestions créées");
    expect(toastSuccess.mock.calls[0][0]).toContain("🏠 1 hors établissement");
    expect(toastSuccess.mock.calls[0][0]).toContain("🏢 1 interne");

    vi.useRealTimers();
  });

  it("passe en erreur quand la fonction retourne une erreur Supabase et affiche le message sanitizé", async () => {
    const thrownError = new Error("x");
    invokeMock.mockResolvedValue({
      data: null,
      error: thrownError,
    });

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useManualEmailClassification(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ batchSize: 12 })).rejects.toThrow("x");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(sanitizeMock).toHaveBeenCalledTimes(1);
    expect(sanitizeMock).toHaveBeenCalledWith(thrownError);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("sanitized:x", {
      duration: 6000,
    });
    expect(debugError).toHaveBeenCalled();
    expect(result.current.error).toBe(thrownError);
  });
});