import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

const { SLOW_ROUTES, USERS_ERRORS, mockRpc, mockFrom, supabaseBuilder } = vi.hoisted(() => {
  const SLOW_ROUTES = [
    { route: "/home", samples: 120, p75: 2300, p95: 4100, avg_value: 2500 },
    { route: "/search", samples: 80, p75: 2600, p95: 5000, avg_value: 2900 },
  ] as const;

  const USERS_ERRORS = [
    {
      user_id: "u1",
      user_email: "u1@test.co",
      error_count: 7,
      last_error_at: "2024-01-01T00:00:00.000Z",
      distinct_types: 3,
    },
    {
      user_id: "u2",
      user_email: null,
      error_count: 4,
      last_error_at: "2024-01-02T00:00:00.000Z",
      distinct_types: 2,
    },
  ] as const;

  type RpcResult = { data: unknown; error: null | { message: string } };
  const mockRpc = vi.fn<(fnName: string, args: unknown) => Promise<RpcResult>>();
  const mockFrom = vi.fn();

  const supabaseBuilder: Record<string, unknown> = {};
  const chainMethods = [
    "select",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "contains",
    "like",
    "ilike",
    "order",
    "limit",
    "range",
    "insert",
    "upsert",
    "update",
    "delete",
    "filter",
    "match",
    "or",
    "is",
    "not",
    "returns",
  ] as const;

  for (const m of chainMethods) {
    supabaseBuilder[m] = vi.fn(() => supabaseBuilder);
  }

  supabaseBuilder.single = vi.fn(async () => ({ data: null, error: null }));
  supabaseBuilder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  supabaseBuilder.then = vi.fn((onFulfilled?: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled)
  );
  supabaseBuilder.catch = vi.fn((onRejected?: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected)
  );

  mockFrom.mockImplementation(() => supabaseBuilder);

  return { SLOW_ROUTES, USERS_ERRORS, mockRpc, mockFrom, supabaseBuilder };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

import { useTopSlowRoutes, useTopUsersWithErrors } from "./useMonitorPerformance";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const Wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return Wrapper;
}

describe("useMonitorPerformance", () => {
  it("useTopSlowRoutes: loading -> success (returns rpc data and uses correct args)", async () => {
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === "get_top_slow_routes") return { data: SLOW_ROUTES, error: null };
      return { data: null, error: { message: "unexpected" } };
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useTopSlowRoutes(12, "LCP"), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith("get_top_slow_routes", {
      p_hours: 12,
      p_metric: "LCP",
      p_limit: 10,
    });

    expect(result.current.data).toEqual([
      { route: "/home", samples: 120, p75: 2300, p95: 4100, avg_value: 2500 },
      { route: "/search", samples: 80, p75: 2600, p95: 5000, avg_value: 2900 },
    ]);
    expect(result.current.data?.[0]?.route).toBe("/home");
    expect(result.current.data?.[1]?.p95).toBe(5000);
  });

  it("useTopSlowRoutes: rpc error -> isError true", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "rpc failed" } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useTopSlowRoutes(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith("get_top_slow_routes", {
      p_hours: 24,
      p_metric: "LCP",
      p_limit: 10,
    });
    expect(result.current.error).toBeTruthy();
  });

  it("useTopUsersWithErrors: loading -> success (returns rpc data and uses correct args)", async () => {
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === "get_top_users_with_errors") return { data: USERS_ERRORS, error: null };
      return { data: null, error: { message: "unexpected" } };
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useTopUsersWithErrors(30), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith("get_top_users_with_errors", {
      p_days: 30,
      p_limit: 10,
    });

    expect(result.current.data).toEqual([
      {
        user_id: "u1",
        user_email: "u1@test.co",
        error_count: 7,
        last_error_at: "2024-01-01T00:00:00.000Z",
        distinct_types: 3,
      },
      {
        user_id: "u2",
        user_email: null,
        error_count: 4,
        last_error_at: "2024-01-02T00:00:00.000Z",
        distinct_types: 2,
      },
    ]);
    expect(result.current.data?.[0]?.distinct_types).toBe(3);
    expect(result.current.data?.[1]?.user_email).toBeNull();
  });

  it("useTopUsersWithErrors: rpc error -> isError true", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "rpc failed" } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useTopUsersWithErrors(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith("get_top_users_with_errors", {
      p_days: 7,
      p_limit: 10,
    });
    expect(result.current.error).toBeTruthy();
  });
});