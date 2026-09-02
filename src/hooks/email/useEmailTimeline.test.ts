/// <reference types="vitest" />
/* @vitest-environment jsdom */

import React, { type PropsWithChildren } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { endOfDay, startOfDay } from 'date-fns';

const {
  THREADS,
  MESSAGES,
  SANITIZE_CALLS,
  mockFrom,
  mockSanitize,
  setSupabaseScenario,
  resetSupabase,
  getCallsByTable,
} = vi.hoisted(() => {
  type SupabaseError = { message: string };

  const THREADS = [
    {
      id: "t1",
      subject: "  Hello   world ",
      last_message_date: "2024-01-03T10:00:00.000Z",
      message_count: 5,
      unread_count: 2,
      ai_summary: "  summary  ",
      participants: null,
      user_email_accounts: { email_address: "me@example.test" },
    },
    {
      id: "t2",
      subject: "Re: Topic",
      last_message_date: "2024-01-01T12:00:00.000Z",
      message_count: 1,
      unread_count: 0,
      ai_summary: null,
      participants: null,
      user_email_accounts: { email_address: "me@example.test" },
    },
  ] as const;

  const MESSAGES = [
    {
      thread_id: "t1",
      from_address: "me@example.test",
      to_addresses: [{ name: "Alice", email: "alice@example.test" }],
      has_attachments: true,
      created_at: "2024-01-03T10:00:00.000Z",
    },
    {
      thread_id: "t1",
      from_address: "bob@example.test",
      to_addresses: [{ name: "Me", email: "me@example.test" }],
      has_attachments: false,
      created_at: "2024-01-02T10:00:00.000Z",
    },
    {
      thread_id: "t2",
      from_address: "someone@example.test",
      to_addresses: [{ name: "Me", email: "me@example.test" }],
      has_attachments: null,
      created_at: "2024-01-01T12:00:00.000Z",
    },
  ] as const;

  const SANITIZE_CALLS: string[] = [];

  const mockSanitize = vi.fn((s: string) => {
    SANITIZE_CALLS.push(s);
    return s.trim().replace(/\s+/g, " ");
  });

  type Scenario = {
    threads: readonly unknown[] | null;
    threadsError: SupabaseError | null;
    messages: readonly unknown[] | null;
  };

  let scenario: Scenario = {
    threads: THREADS,
    threadsError: null,
    messages: MESSAGES,
  };

  const setSupabaseScenario = (next: Partial<Scenario>) => {
    scenario = { ...scenario, ...next };
  };

  type CallRec = { op: string; args: unknown[] };
  type BuilderState = { table: string; ops: CallRec[] };

  const builderStates: BuilderState[] = [];

  const makeThenableBuilder = (state: BuilderState) => {
    const builder: Record<string, unknown> = {};

    const chain =
      (op: string) =>
      (...args: unknown[]) => {
        state.ops.push({ op, args });
        return builder;
      };

    builder.select = chain("select");
    builder.eq = chain("eq");
    builder.gte = chain("gte");
    builder.lte = chain("lte");
    builder.in = chain("in");
    builder.order = chain("order");
    builder.limit = chain("limit");
    builder.insert = chain("insert");
    builder.update = chain("update");
    builder.delete = chain("delete");

    builder.single = () =>
      Promise.resolve({
        data: state.table === "email_threads" ? scenario.threads : scenario.messages,
        error: state.table === "email_threads" ? scenario.threadsError : null,
      });

    builder.maybeSingle = builder.single;

    builder.then = (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      const payload =
        state.table === "email_threads"
          ? { data: scenario.threads, error: scenario.threadsError }
          : { data: scenario.messages, error: null };
      return Promise.resolve(payload).then(onFulfilled, onRejected);
    };

    builder.catch = (onRejected?: (reason: unknown) => unknown) => {
      const payload =
        state.table === "email_threads"
          ? { data: scenario.threads, error: scenario.threadsError }
          : { data: scenario.messages, error: null };
      return Promise.resolve(payload).catch(onRejected);
    };

    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    const state: BuilderState = { table, ops: [] };
    builderStates.push(state);
    return makeThenableBuilder(state);
  });

  const getCallsByTable = (table: string) =>
    builderStates.filter((s) => s.table === table).flatMap((s) => s.ops);

  const resetSupabase = () => {
    scenario = { threads: THREADS, threadsError: null, messages: MESSAGES };
    SANITIZE_CALLS.length = 0;
    mockSanitize.mockClear();
    mockFrom.mockClear();
    builderStates.length = 0;
  };

  return {
    THREADS,
    MESSAGES,
    SANITIZE_CALLS,
    mockFrom,
    mockSanitize,
    setSupabaseScenario,
    resetSupabase,
    getCallsByTable,
  };
});

vi.mock("@/lib/supabaseBrowser", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/lib/emailUtils", () => ({
  sanitizeEmailSubject: mockSanitize,
}));

import { useEmailTimeline, type InteractionType, type TimelinePeriod } from "./useEmailTimeline";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const createWrapper = () => {
  const queryClient = createQueryClient();
  const Wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
};

describe("useEmailTimeline", () => {
  it("charge puis retourne les événements + stats + chartData (interactionType=all)", async () => {
    resetSupabase();

    const filters: {
      period: TimelinePeriod;
      interactionType: InteractionType;
      customStartDate?: Date;
      customEndDate?: Date;
    } = { period: "all", interactionType: "all" };

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useEmailTimeline("eta_1", filters), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("email_threads");
    expect(mockFrom).toHaveBeenCalledWith("email_messages");

    const data = result.current.data;
    expect(data).toBeTruthy();
    if (!data) throw new Error("Expected data");

    expect(data.events).toHaveLength(2);

    expect(data.events[0]).toMatchObject({
      id: "t1",
      thread_id: "t1",
      subject: "Hello world",
      timestamp: "2024-01-03T10:00:00.000Z",
      type: "sent",
      participant: "Alice",
      message_count: 5,
      unread_count: 2,
      ai_summary: "summary",
      has_attachments: true,
    });

    expect(data.events[1]).toMatchObject({
      id: "t2",
      thread_id: "t2",
      subject: "Re: Topic",
      timestamp: "2024-01-01T12:00:00.000Z",
      type: "received",
      participant: "someone@example.test",
      message_count: 1,
      unread_count: 0,
      ai_summary: null,
      has_attachments: false,
    });

    expect(data.stats).toEqual({
      totalEvents: 2,
      sentCount: 1,
      receivedCount: 1,
      unreadCount: 2,
      withAttachments: 1,
    });

    expect(data.chartData).toEqual([
      { date: "2024-01-01", sent: 0, received: 1 },
      { date: "2024-01-03", sent: 1, received: 0 },
    ]);

    expect(mockSanitize).toHaveBeenCalledTimes(3);
    expect(SANITIZE_CALLS).toEqual(["  Hello   world ", "  summary  ", "Re: Topic"]);
  });

  it("filtre les événements selon interactionType=sent", async () => {
    resetSupabase();

    const filters: {
      period: TimelinePeriod;
      interactionType: InteractionType;
      customStartDate?: Date;
      customEndDate?: Date;
    } = { period: "all", interactionType: "sent" };

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEmailTimeline("eta_1", filters), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data).toBeTruthy();
    if (!data) throw new Error("Expected data");

    expect(data.events).toHaveLength(1);
    expect(data.events[0]).toMatchObject({
      id: "t1",
      type: "sent",
      participant: "Alice",
      has_attachments: true,
    });

    expect(data.stats).toEqual({
      totalEvents: 1,
      sentCount: 1,
      receivedCount: 0,
      unreadCount: 2,
      withAttachments: 1,
    });

    expect(data.chartData).toEqual([{ date: "2024-01-03", sent: 1, received: 0 }]);
  });

  it("passe en erreur si Supabase renvoie { error } sur la requête threads", async () => {
    resetSupabase();
    setSupabaseScenario({ threads: null, threadsError: { message: "x" } });

    const filters: {
      period: TimelinePeriod;
      interactionType: InteractionType;
      customStartDate?: Date;
      customEndDate?: Date;
    } = { period: "all", interactionType: "all" };

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEmailTimeline("eta_1", filters), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const err = result.current.error as { message?: unknown } | null;
    expect(err && err.message).toBe("x");
  });

  it("renvoie vide si aucun thread", async () => {
    resetSupabase();
    setSupabaseScenario({ threads: [], threadsError: null, messages: MESSAGES });

    const filters: {
      period: TimelinePeriod;
      interactionType: InteractionType;
      customStartDate?: Date;
      customEndDate?: Date;
    } = { period: "all", interactionType: "all" };

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEmailTimeline("eta_1", filters), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data).toBeTruthy();
    if (!data) throw new Error("Expected data");

    expect(data.events).toEqual([]);
    expect(data.stats).toEqual({
      totalEvents: 0,
      sentCount: 0,
      receivedCount: 0,
      unreadCount: 0,
      withAttachments: 0,
    });
    expect(data.chartData).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("email_threads");
  });

  it("applique la période custom (gte/lte appelés avec des ISO startOfDay/endOfDay)", async () => {
    resetSupabase();

    const filters: {
      period: TimelinePeriod;
      interactionType: InteractionType;
      customStartDate?: Date;
      customEndDate?: Date;
    } = {
      period: "custom",
      interactionType: "all",
      customStartDate: new Date("2024-01-01T08:00:00.000Z"),
      customEndDate: new Date("2024-01-05T09:00:00.000Z"),
    };

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEmailTimeline("eta_1", filters), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const threadCalls = getCallsByTable("email_threads");
    const gteCall = threadCalls.find((c) => c.op === "gte");
    const lteCall = threadCalls.find((c) => c.op === "lte");

    expect(gteCall).toBeTruthy();
    expect(lteCall).toBeTruthy();

    if (!gteCall || !lteCall) throw new Error("Expected gte/lte calls");

    expect(gteCall.args[0]).toBe("last_message_date");
    expect(typeof gteCall.args[1]).toBe("string");
    expect(String(gteCall.args[1])).toBe(startOfDay(filters.customStartDate!).toISOString());

    expect(lteCall.args[0]).toBe("last_message_date");
    expect(typeof lteCall.args[1]).toBe("string");
    expect(String(lteCall.args[1])).toBe(endOfDay(filters.customEndDate!).toISOString());

    expect(result.current.data?.events.length).toBe(2);
  });
});