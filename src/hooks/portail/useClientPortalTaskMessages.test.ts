const {
  TASK_ROWS,
  PROFILE_ROW,
  NEW_ROW,
  AUTH_USER,
  responseConfig,
  mockFrom,
  mockInsert,
  mockDelete,
  toastError,
  toastSuccess,
} = vi.hoisted(() => {
  const TASK_ROWS = [
    {
      id: "m1",
      task_id: "t1",
      author_type: "marque",
      author_user_id: "u1",
      author_name: "Alice Staff",
      content: "First message",
      is_internal: false,
      created_at: "2023-01-01T00:00:00.000Z",
      updated_at: "2023-01-01T00:00:00.000Z",
    },
    {
      id: "m2",
      task_id: "t1",
      author_type: "etablissement",
      author_user_id: null,
      author_name: "Client",
      content: "Second message",
      is_internal: false,
      created_at: "2023-01-02T00:00:00.000Z",
      updated_at: "2023-01-02T00:00:00.000Z",
    },
  ];

  const PROFILE_ROW = { prenom: "Alice", nom: "Staff" };

  const NEW_ROW = {
    id: "m3",
    task_id: "t1",
    author_type: "marque",
    author_user_id: "u1",
    author_name: "Alice Staff",
    content: "New message from staff",
    is_internal: false,
    created_at: "2023-01-03T00:00:00.000Z",
    updated_at: "2023-01-03T00:00:00.000Z",
  };

  const AUTH_USER = { id: "u1", email: "alice@example.com" };

  const responseConfig = {
    rows: TASK_ROWS.slice(),
    profile: { ...PROFILE_ROW },
    insertReturn: { ...NEW_ROW },
    tableQueryErrors: new Map(),
    insertErrorForTable: new Map(),
    deleteErrorForTable: new Map(),
  };

  const mockInsert = vi.fn();
  const mockDelete = vi.fn();

  const mockFrom = vi.fn((tableName) => {
    const state = {
      lastEq: null as null | { col: string; val: unknown },
      didOrder: false,
      didMaybeSingle: false,
      didSingle: false,
      didInsert: false,
      didDelete: false,
      payload: undefined as unknown,
    };

    const builder: any = {
      select(arg?: unknown) {
        this._selectArg = arg;
        return this;
      },
      eq(col: string, val: unknown) {
        state.lastEq = { col, val };
        return this;
      },
      order(_col: string, _opts?: unknown) {
        state.didOrder = true;
        return this;
      },
      maybeSingle() {
        state.didMaybeSingle = true;
        return this;
      },
      single() {
        state.didSingle = true;
        return this;
      },
      insert(payload: unknown) {
        state.didInsert = true;
        state.payload = payload;
        mockInsert(payload);
        return this;
      },
      delete() {
        state.didDelete = true;
        return this;
      },
      then(onFulfill: (v: unknown) => unknown) {
        let resp: { data: unknown; error: null | { message: string } } = { data: null, error: null };

        if (tableName === "profiles" && state.didMaybeSingle) {
          resp = { data: responseConfig.profile ?? null, error: null };
          return Promise.resolve(onFulfill(resp));
        }

        if (tableName === "client_portal_task_messages" && state.didInsert && state.didSingle) {
          const insertErr = responseConfig.insertErrorForTable.get(tableName) ?? null;
          if (insertErr) {
            resp = { data: null, error: insertErr };
          } else {
            resp = { data: responseConfig.insertReturn ?? null, error: null };
          }
          return Promise.resolve(onFulfill(resp));
        }

        if (tableName === "client_portal_task_messages" && state.didDelete) {
          const delErr = responseConfig.deleteErrorForTable.get(tableName) ?? null;
          const idEq = state.lastEq?.col === "id" ? state.lastEq?.val : undefined;
          if (typeof idEq !== "undefined") {
            mockDelete(idEq);
          }
          resp = { data: null, error: delErr };
          return Promise.resolve(onFulfill(resp));
        }

        if (tableName === "client_portal_task_messages" && state.lastEq?.col === "task_id") {
          const qErr = responseConfig.tableQueryErrors.get(tableName) ?? null;
          if (qErr) {
            resp = { data: null, error: qErr };
            return Promise.resolve(onFulfill(resp));
          }
          const taskId = state.lastEq.val as string;
          const rows = (responseConfig.rows ?? []).filter((r) => r.task_id === taskId);
          resp = { data: rows, error: null };
          return Promise.resolve(onFulfill(resp));
        }

        resp = { data: null, error: null };
        return Promise.resolve(onFulfill(resp));
      },
      catch() {
        return this;
      },
    };

    return builder;
  });

  const toastError = vi.fn();
  const toastSuccess = vi.fn();

  return {
    TASK_ROWS,
    PROFILE_ROW,
    NEW_ROW,
    AUTH_USER,
    responseConfig,
    mockFrom,
    mockInsert,
    mockDelete,
    toastError,
    toastSuccess,
  };
});

// Mock external modules BEFORE importing the module under test
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: AUTH_USER }),
}));

vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import {
  useClientPortalTaskMessages,
  useCreateClientPortalTaskMessage,
  useDeleteClientPortalTaskMessage,
} from "./useClientPortalTaskMessages";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useClientPortalTaskMessages hook - query", () => {
  beforeEach(() => {
    responseConfig.rows.length = 0;
    responseConfig.rows.push(
      {
        id: "m1",
        task_id: "t1",
        author_type: "marque",
        author_user_id: "u1",
        author_name: "Alice Staff",
        content: "First message",
        is_internal: false,
        created_at: "2023-01-01T00:00:00.000Z",
        updated_at: "2023-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        task_id: "t1",
        author_type: "etablissement",
        author_user_id: null,
        author_name: "Client",
        content: "Second message",
        is_internal: false,
        created_at: "2023-01-02T00:00:00.000Z",
        updated_at: "2023-01-02T00:00:00.000Z",
      }
    );
    responseConfig.profile = { prenom: "Alice", nom: "Staff" };
    responseConfig.insertReturn = { ...NEW_ROW };
    responseConfig.tableQueryErrors.clear();
    responseConfig.insertErrorForTable.clear();
    responseConfig.deleteErrorForTable.clear();

    mockFrom.mockClear();
    mockInsert.mockClear();
    mockDelete.mockClear();
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it("loads messages for a given taskId and returns them ordered", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useClientPortalTaskMessages("t1"), { wrapper });

    expect(result.current.isFetching || result.current.isLoading).toBeTruthy();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0].id).toBe("m1");
    expect(result.current.data[0].content).toBe("First message");
    expect(result.current.data[1].id).toBe("m2");
    expect(result.current.data[1].content).toBe("Second message");

    expect(mockFrom).toHaveBeenCalled();
    expect(mockFrom.mock.calls[0][0]).toBe("client_portal_task_messages");
  });

  it("exposes error state when supabase returns an error for the query", async () => {
    responseConfig.tableQueryErrors.set("client_portal_task_messages", { message: "fetch failed" });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useClientPortalTaskMessages("t1"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect((result.current.error as Error).message).toBe("fetch failed");
  });
});

describe("mutations: create and delete client portal task messages", () => {
  beforeEach(() => {
    responseConfig.rows.length = 0;
    responseConfig.rows.push({
      id: "m1",
      task_id: "t1",
      author_type: "marque",
      author_user_id: "u1",
      author_name: "Alice Staff",
      content: "First message",
      is_internal: false,
      created_at: "2023-01-01T00:00:00.000Z",
      updated_at: "2023-01-01T00:00:00.000Z",
    });
    responseConfig.profile = { prenom: "Alice", nom: "Staff" };
    responseConfig.insertReturn = { ...NEW_ROW };
    responseConfig.tableQueryErrors.clear();
    responseConfig.insertErrorForTable.clear();
    responseConfig.deleteErrorForTable.clear();

    mockFrom.mockClear();
    mockInsert.mockClear();
    mockDelete.mockClear();
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it("creates a new message and invalidates queries", async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateClientPortalTaskMessage(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ task_id: "t1", content: "New message from staff" });
    });

    expect(mockInsert).toHaveBeenCalled();
    const calledPayload = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(calledPayload.task_id).toBe("t1");
    expect(calledPayload.content).toBe("New message from staff");
    expect(calledPayload.author_type).toBe("marque");
    expect(calledPayload.author_user_id).toBe("u1");
    expect(calledPayload.author_name).toBe("Alice Staff");
    expect(calledPayload.is_internal).toBe(false);

    expect(invalidateSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["client_portal_task_messages", "t1"] });

    expect(toastError).not.toHaveBeenCalled();

    invalidateSpy.mockRestore();
  });

  it("deletes a message, shows a success toast and invalidates queries", async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteClientPortalTaskMessage(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: "m1", task_id: "t1" });
    });

    expect(mockDelete).toHaveBeenCalledWith("m1");

    expect(toastSuccess).toHaveBeenCalledWith("Message supprimé");

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["client_portal_task_messages", "t1"] });

    invalidateSpy.mockRestore();
  });

  it("shows error toast when delete fails", async () => {
    responseConfig.deleteErrorForTable.set("client_portal_task_messages", { message: "delete failed" });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteClientPortalTaskMessage(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: "m1", task_id: "t1" })).rejects.toBeDefined();
    });

    expect(toastError).toHaveBeenCalled();
    const callArg = toastError.mock.calls[0][0];
    expect(callArg).toBe("delete failed");
  });
});