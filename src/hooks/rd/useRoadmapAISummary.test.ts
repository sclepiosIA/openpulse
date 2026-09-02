import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockFrom, builder, setNextResult } = vi.hoisted(() => {
  type Next = { data: unknown; error: unknown };

  let next: Next = { data: null, error: null };

  const builder: Record<string, any> = {};

  const makeChainable = (name: string) => {
    builder[name] = vi.fn(() => builder);
  };

  // common query builder methods used by hooks
  [
    "select",
    "order",
    "limit",
    "eq",
    "gte",
    "lte",
    "in",
    "insert",
    "update",
    "delete",
    "order",
  ].forEach(makeChainable);

  builder.maybeSingle = vi.fn(() => Promise.resolve(next));
  builder.single = vi.fn(() => Promise.resolve(next));

  // make builder thenable to support await supabase.from(...).then-style usage
  builder.then = vi.fn((onFulfilled: any, onRejected: any) => {
    return Promise.resolve(next).then(onFulfilled, onRejected);
  });
  builder.catch = vi.fn((onRejected: any) => {
    return Promise.resolve(next).catch(onRejected);
  });

  const mockFrom = vi.fn(() => builder);

  const setNextResult = (r: Next) => {
    next = r;
    return next;
  };

  return { mockFrom, builder, setNextResult };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mockFrom } }));

import { useLatestRoadmapSummary } from "./useRoadmapAISummary";

describe("useLatestRoadmapSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads then returns the latest roadmap summary on success and queries supabase as expected", async () => {
    const expected = {
      dpi: "dpi-1",
      generated_at: "2024-01-01T00:00:00.000Z",
      source_count: 5,
      model: "model-x",
    };

    setNextResult({ data: expected, error: null });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useLatestRoadmapSummary(), { wrapper });

    // initial state should be loading
    expect(result.current.isLoading).toBe(true);

    // wait for the query to succeed
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // data should match the expected summary
    expect(result.current.data).toEqual(expected);

    // ensure supabase client was called correctly
    expect(mockFrom).toHaveBeenCalledWith("roadmap_ai_summaries");
    expect(builder.select).toHaveBeenCalledWith("dpi, generated_at, source_count, model");
    expect(builder.order).toHaveBeenCalledWith("generated_at", { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
    // ensure maybeSingle was invoked to produce possibly-null single result
    expect(builder.maybeSingle).toHaveBeenCalled();
  });

  it("sets isError when supabase returns an error from maybeSingle", async () => {
    const supabaseError = { message: "query failed" };
    setNextResult({ data: null, error: supabaseError });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useLatestRoadmapSummary(), { wrapper });

    // initially loading
    expect(result.current.isLoading).toBe(true);

    // wait until error state
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // the error returned by the hook should be the supabase error object
    expect(result.current.error).toEqual(supabaseError);

    // ensure same supabase query shape was attempted
    expect(mockFrom).toHaveBeenCalledWith("roadmap_ai_summaries");
    expect(builder.select).toHaveBeenCalledWith("dpi, generated_at, source_count, model");
    expect(builder.order).toHaveBeenCalledWith("generated_at", { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
    expect(builder.maybeSingle).toHaveBeenCalled();
  });
});