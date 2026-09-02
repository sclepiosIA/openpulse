/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useQuoteValidationMutation } from "./useQuoteValidationMutation";

const {
  SUCCESS_RESPONSE,
  ERROR_RESPONSE,
  mockFrom,
  mockUpdate,
  mockEq,
  mockThen,
  mockCatch,
  toastSuccess,
  toastError,
  sanitizeSupabaseError,
} = vi.hoisted(() => {
  const SUCCESS_RESPONSE = { data: null, error: null };
  const ERROR_RESPONSE = { data: null, error: { message: "x" } };

  return {
    SUCCESS_RESPONSE,
    ERROR_RESPONSE,
    mockFrom: vi.fn(),
    mockUpdate: vi.fn(),
    mockEq: vi.fn(),
    mockThen: vi.fn(),
    mockCatch: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    sanitizeSupabaseError: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: mockEq,
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: mockUpdate,
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(SUCCESS_RESPONSE)),
    maybeSingle: vi.fn(() => Promise.resolve(SUCCESS_RESPONSE)),
    then: mockThen,
    catch: mockCatch,
  };

  mockUpdate.mockImplementation(() => builder);
  mockEq.mockImplementation(() => Promise.resolve(SUCCESS_RESPONSE));
  mockThen.mockImplementation((onFulfilled: (value: typeof SUCCESS_RESPONSE) => unknown) =>
    Promise.resolve(onFulfilled(SUCCESS_RESPONSE))
  );
  mockCatch.mockImplementation(() => Promise.resolve(SUCCESS_RESPONSE));
  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
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

function createWrapper(client: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, props.children);
  };
}

describe("useQuoteValidationMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockResolvedValue(SUCCESS_RESPONSE);
    mockThen.mockImplementation((onFulfilled: (value: typeof SUCCESS_RESPONSE) => unknown) =>
      Promise.resolve(onFulfilled(SUCCESS_RESPONSE))
    );
    mockCatch.mockImplementation(() => Promise.resolve(SUCCESS_RESPONSE));
    sanitizeSupabaseError.mockReturnValue("Erreur lisible");
  });

  it("passe par isPending puis enregistre une offre au succès avec les valeurs métier attendues", async () => {
    let resolveEq: ((value: typeof SUCCESS_RESPONSE) => void) | undefined;
    const pendingPromise = new Promise<typeof SUCCESS_RESPONSE>((resolve) => {
      resolveEq = resolve;
    });
    mockEq.mockReturnValueOnce(pendingPromise);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries").mockResolvedValue();

    const { result } = renderHook(() => useQuoteValidationMutation(), {
      wrapper: createWrapper(client),
    });

    const payload = {
      type: "succes" as const,
      etablissementId: "eta-1",
      etablissementNom: "Lycée Horizon",
      pallierVise: "3",
      tarifsData: { "1": 100, "2": 200, "3": 300 },
      seuilsData: { "1": 10, "2": 20, "3": 30 },
      fraisAcces: 49,
    };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    resolveEq?.(SUCCESS_RESPONSE);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("etablissements");
    expect(mockUpdate).toHaveBeenCalledWith({
      type_offre: "Au succès",
      pallier_vise: "Palier 3",
      tarifs_palliers: { "1": 100, "2": 200, "3": 300 },
      seuils_palliers: { "1": 10, "2": 20, "3": 30 },
      modele_statique_succes: null,
    });
    expect(mockEq).toHaveBeenCalledWith("id", "eta-1");
    expect(result.current.data).toEqual(payload);
    expect(toastSuccess).toHaveBeenCalledWith('Offre "Au succès" enregistrée pour Lycée Horizon');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["etablissement", "eta-1"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["etablissements"] });
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it("enregistre une offre statique avec le mapping exact attendu", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries").mockResolvedValue();

    const { result } = renderHook(() => useQuoteValidationMutation(), {
      wrapper: createWrapper(client),
    });

    const payload = {
      type: "statique" as const,
      etablissementId: "eta-2",
      etablissementNom: "Campus Atlas",
      tarifAnnuel: 1200,
      fraisAcces: 75,
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("etablissements");
    expect(mockUpdate).toHaveBeenCalledWith({
      type_offre: "Statique",
      modele_statique_succes: "1200",
      tarifs_palliers: { frais_acces: 75 },
      pallier_vise: null,
      seuils_palliers: null,
    });
    expect(mockEq).toHaveBeenCalledWith("id", "eta-2");
    expect(result.current.data).toEqual(payload);
    expect(toastSuccess).toHaveBeenCalledWith('Offre "Statique" enregistrée pour Campus Atlas');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["etablissement", "eta-2"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["etablissements"] });
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it("passe en erreur et affiche le message sanitizé quand Supabase renvoie une erreur", async () => {
    mockEq.mockResolvedValueOnce(ERROR_RESPONSE);
    sanitizeSupabaseError.mockReturnValueOnce("Erreur lisible");

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries").mockResolvedValue();

    const { result } = renderHook(() => useQuoteValidationMutation(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          type: "succes",
          etablissementId: "eta-3",
          etablissementNom: "École Nova",
          pallierVise: "2",
          tarifsData: { "1": 150 },
          seuilsData: { "1": 15 },
          fraisAcces: 20,
        })
      ).rejects.toEqual(ERROR_RESPONSE.error);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(sanitizeSupabaseError).toHaveBeenCalledWith(ERROR_RESPONSE.error);
    expect(toastError).toHaveBeenCalledWith("Erreur lisible");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});