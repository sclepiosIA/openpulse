/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { usePortfolioHealth } from "./usePortfolioHealth";

const {
  HEALTH_ROWS,
  EMPTY_ROWS,
  AUTH_STATE,
  mockFrom,
  mockSelect,
  mockIn,
  mockEq,
  mockGte,
  mockLte,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
  mockThen,
  mockCatch,
  builder,
} = vi.hoisted(() => {
  const HEALTH_ROWS = [
    { etablissement_id: "e1", health_status: "healthy", health_score: 90, nps_score: 9 },
    { etablissement_id: "e2", health_status: "warning", health_score: 50, nps_score: 6 },
    { etablissement_id: "e3", health_status: "critical", health_score: 20, nps_score: 2 },
    { etablissement_id: "e4", health_status: null, health_score: 75, nps_score: 4 },
    { etablissement_id: "e5", health_status: null, health_score: 45, nps_score: 5 },
  ];

  const EMPTY_ROWS: Array<never> = [];

  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockIn = vi.fn();
  const mockEq = vi.fn();
  const mockGte = vi.fn();
  const mockLte = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockThen = vi.fn();
  const mockCatch = vi.fn();

  const builder = {
    select: mockSelect,
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    in: mockIn,
    order: mockOrder,
    limit: mockLimit,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: mockThen,
    catch: mockCatch,
  };

  mockSelect.mockReturnValue(builder);
  mockEq.mockReturnValue(builder);
  mockGte.mockReturnValue(builder);
  mockLte.mockReturnValue(builder);
  mockIn.mockReturnValue(builder);
  mockOrder.mockReturnValue(builder);
  mockLimit.mockReturnValue(builder);
  mockInsert.mockReturnValue(builder);
  mockUpdate.mockReturnValue(builder);
  mockDelete.mockReturnValue(builder);
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });

  return {
    HEALTH_ROWS,
    EMPTY_ROWS,
    AUTH_STATE,
    mockFrom,
    mockSelect,
    mockIn,
    mockEq,
    mockGte,
    mockLte,
    mockOrder,
    mockLimit,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockSingle,
    mockMaybeSingle,
    mockThen,
    mockCatch,
    builder,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePortfolioHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue(builder);
    mockSelect.mockReturnValue(builder);
    mockEq.mockReturnValue(builder);
    mockGte.mockReturnValue(builder);
    mockLte.mockReturnValue(builder);
    mockIn.mockReturnValue(builder);
    mockOrder.mockReturnValue(builder);
    mockLimit.mockReturnValue(builder);
    mockInsert.mockReturnValue(builder);
    mockUpdate.mockReturnValue(builder);
    mockDelete.mockReturnValue(builder);
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    mockThen.mockImplementation((onFulfilled?: (value: { data: typeof HEALTH_ROWS; error: null }) => unknown) =>
      Promise.resolve(onFulfilled ? onFulfilled({ data: HEALTH_ROWS, error: null }) : { data: HEALTH_ROWS, error: null }),
    );
    mockCatch.mockImplementation(() => Promise.resolve({ data: HEALTH_ROWS, error: null }));
  });

  it("reste idle sans lancer de requête quand aucun établissement n'est fourni", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => usePortfolioHealth([], 12), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.status).toBe("pending");
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("charge puis calcule correctement les métriques à partir des statuts et scores", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => usePortfolioHealth(["e1", "e2", "e3", "e4", "e5", "e6", "e7"], 7), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("customer_health_metrics");
    expect(mockSelect).toHaveBeenCalledWith("etablissement_id, health_status, health_score, nps_score");
    expect(mockIn).toHaveBeenCalledWith("etablissement_id", ["e1", "e2", "e3", "e4", "e5", "e6", "e7"]);
    expect(result.current.data).toEqual({
      satisfaits: 3,
      aSurveiller: 3,
      aRisque: 1,
      totalAvecMetriques: 5,
    });
  });

  it("utilise la répartition par défaut quand aucune métrique n'est renvoyée", async () => {
    mockThen.mockImplementation((onFulfilled?: (value: { data: typeof EMPTY_ROWS; error: null }) => unknown) =>
      Promise.resolve(onFulfilled ? onFulfilled({ data: EMPTY_ROWS, error: null }) : { data: EMPTY_ROWS, error: null }),
    );
    mockCatch.mockImplementation(() => Promise.resolve({ data: EMPTY_ROWS, error: null }));

    const wrapper = createWrapper();

    const { result } = renderHook(() => usePortfolioHealth(["e1", "e2", "e3", "e4", "e5"], 10), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      satisfaits: 7,
      aSurveiller: 2,
      aRisque: 1,
      totalAvecMetriques: 0,
    });
  });

  it("passe en erreur si Supabase rejette la requête", async () => {
    const queryError = new Error("x");

    mockThen.mockImplementation((onFulfilled?: unknown, onRejected?: (reason: Error) => unknown) => {
      if (onRejected) {
        return Promise.resolve(onRejected(queryError));
      }
      return Promise.reject(queryError);
    });
    mockCatch.mockImplementation((onRejected?: (reason: Error) => unknown) =>
      Promise.resolve(onRejected ? onRejected(queryError) : undefined),
    );

    const wrapper = createWrapper();

    const { result } = renderHook(() => usePortfolioHealth(["e1"], 1), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(queryError);
    expect(result.current.error?.message).toBe("x");
  });
});