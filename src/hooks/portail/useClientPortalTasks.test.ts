/* @vitest-environment jsdom */

import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useClientPortalTasks,
  useClientPortalTasksPendingCount,
  useCreateClientPortalTask,
  useDeleteClientPortalTask,
  useUpdateClientPortalTask,
} from "./useClientPortalTasks";

const {
  TASKS_ROWS,
  CREATED_ROW,
  UPDATED_ROW,
  AUTH_STATE,
  TASKS_QUERY_RESULT,
  COUNT_QUERY_RESULT,
  CREATED_RESULT,
  UPDATED_RESULT,
  DELETE_RESULT,
  QUERY_ERROR_RESULT,
  MUTATION_ERROR_RESULT,
  toastSuccess,
  toastError,
  mockFrom,
  mockSelect,
  mockEq,
  mockNeq,
  mockGte,
  mockLte,
  mockIn,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
  builderState,
} = vi.hoisted(() => {
  const TASKS_ROWS = [
    {
      id: "task-1",
      etablissement_id: "eta-1",
      titre: "Préparer le lancement",
      description: "Checklist initiale",
      assignee: "marque" as const,
      created_by: "marque" as const,
      created_by_user_id: "user-1",
      statut: "todo" as const,
      phase: "deploiement" as const,
      due_date: "2024-05-10",
      done_at: null,
      done_by: null,
      comment: "Prioritaire",
      created_at: "2024-05-01T10:00:00.000Z",
      updated_at: "2024-05-01T10:00:00.000Z",
    },
    {
      id: "task-2",
      etablissement_id: "eta-1",
      titre: "Former l'équipe",
      description: null,
      assignee: "etablissement" as const,
      created_by: "marque" as const,
      created_by_user_id: "user-1",
      statut: "in_progress" as const,
      phase: "production" as const,
      due_date: null,
      done_at: null,
      done_by: null,
      comment: null,
      created_at: "2024-04-20T09:00:00.000Z",
      updated_at: "2024-04-20T09:00:00.000Z",
    },
  ];

  const CREATED_ROW = {
    id: "task-3",
    etablissement_id: "eta-1",
    titre: "Créer un accès",
    description: "Compte principal",
    assignee: "marque" as const,
    created_by: "marque" as const,
    created_by_user_id: "user-1",
    statut: "todo" as const,
    phase: "deploiement" as const,
    due_date: "2024-06-15",
    done_at: null,
    done_by: null,
    comment: "À faire vite",
    created_at: "2024-06-01T08:00:00.000Z",
    updated_at: "2024-06-01T08:00:00.000Z",
  };

  const UPDATED_ROW = {
    ...TASKS_ROWS[0],
    statut: "done" as const,
    done_at: "2024-06-02T12:00:00.000Z",
    done_by: "user-1",
    updated_at: "2024-06-02T12:00:00.000Z",
  };

  const AUTH_STATE = {
    user: { id: "user-1", email: "test@local.dev" },
    session: { user: { id: "user-1" } },
    isLoading: false,
  };

  const TASKS_QUERY_RESULT = { data: TASKS_ROWS, error: null, count: null };
  const COUNT_QUERY_RESULT = { data: null, error: null, count: 3 };
  const CREATED_RESULT = { data: CREATED_ROW, error: null, count: null };
  const UPDATED_RESULT = { data: UPDATED_ROW, error: null, count: null };
  const DELETE_RESULT = { data: null, error: null, count: null };
  const QUERY_ERROR_RESULT = { data: null, error: { message: "x" }, count: null };
  const MUTATION_ERROR_RESULT = { data: null, error: new Error("x"), count: null };

  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockNeq = vi.fn();
  const mockGte = vi.fn();
  const mockLte = vi.fn();
  const mockIn = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();

  const builderState = {
    result: TASKS_QUERY_RESULT as unknown,
    table: "",
    selectArg: undefined as unknown,
    selectOptions: undefined as unknown,
    insertArg: undefined as unknown,
    updateArg: undefined as unknown,
    deleteCalled: false,
    eqCalls: [] as Array<[string, unknown]>,
    neqCalls: [] as Array<[string, unknown]>,
    orderCalls: [] as Array<[string, unknown]>,
  };

  return {
    TASKS_ROWS,
    CREATED_ROW,
    UPDATED_ROW,
    AUTH_STATE,
    TASKS_QUERY_RESULT,
    COUNT_QUERY_RESULT,
    CREATED_RESULT,
    UPDATED_RESULT,
    DELETE_RESULT,
    QUERY_ERROR_RESULT,
    MUTATION_ERROR_RESULT,
    toastSuccess,
    toastError,
    mockFrom,
    mockSelect,
    mockEq,
    mockNeq,
    mockGte,
    mockLte,
    mockIn,
    mockOrder,
    mockLimit,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockSingle,
    mockMaybeSingle,
    builderState,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    neq: mockNeq,
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
    then: (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(builderState.result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(builderState.result).catch(onRejected),
  };

  mockSelect.mockImplementation((arg?: unknown, options?: unknown) => {
    builderState.selectArg = arg;
    builderState.selectOptions = options;
    return builder;
  });

  mockEq.mockImplementation((column: string, value: unknown) => {
    builderState.eqCalls.push([column, value]);
    return builder;
  });

  mockNeq.mockImplementation((column: string, value: unknown) => {
    builderState.neqCalls.push([column, value]);
    return builder;
  });

  mockGte.mockImplementation(() => builder);
  mockLte.mockImplementation(() => builder);
  mockIn.mockImplementation(() => builder);

  mockOrder.mockImplementation((column: string, options?: unknown) => {
    builderState.orderCalls.push([column, options]);
    return builder;
  });

  mockLimit.mockImplementation(() => builder);

  mockInsert.mockImplementation((payload: unknown) => {
    builderState.insertArg = payload;
    return builder;
  });

  mockUpdate.mockImplementation((payload: unknown) => {
    builderState.updateArg = payload;
    return builder;
  });

  mockDelete.mockImplementation(() => {
    builderState.deleteCalled = true;
    return builder;
  });

  mockSingle.mockImplementation(async () => builderState.result);
  mockMaybeSingle.mockImplementation(async () => builderState.result);

  mockFrom.mockImplementation((table: string) => {
    builderState.table = table;
    return builder;
  });

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

function resetBuilderState() {
  builderState.result = TASKS_QUERY_RESULT;
  builderState.table = "";
  builderState.selectArg = undefined;
  builderState.selectOptions = undefined;
  builderState.insertArg = undefined;
  builderState.updateArg = undefined;
  builderState.deleteCalled = false;
  builderState.eqCalls = [];
  builderState.neqCalls = [];
  builderState.orderCalls = [];

  mockFrom.mockClear();
  mockSelect.mockClear();
  mockEq.mockClear();
  mockNeq.mockClear();
  mockGte.mockClear();
  mockLte.mockClear();
  mockIn.mockClear();
  mockOrder.mockClear();
  mockLimit.mockClear();
  mockInsert.mockClear();
  mockUpdate.mockClear();
  mockDelete.mockClear();
  mockSingle.mockClear();
  mockMaybeSingle.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
}

describe("useClientPortalTasks", () => {
  beforeEach(() => {
    resetBuilderState();
  });

  it("charge puis retourne les tâches de l'établissement avec les paramètres de requête attendus", async () => {
    const client = createClient();

    const { result } = renderHook(() => useClientPortalTasks("eta-1"), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("client_portal_tasks");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEq).toHaveBeenCalledWith("etablissement_id", "eta-1");
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(builderState.table).toBe("client_portal_tasks");
    expect(builderState.selectArg).toBe("*");
    expect(builderState.eqCalls).toContainEqual(["etablissement_id", "eta-1"]);
    expect(builderState.orderCalls).toContainEqual(["created_at", { ascending: false }]);
    expect(result.current.data).toBe(TASKS_ROWS);
    expect(result.current.data?.[0]?.titre).toBe("Préparer le lancement");
    expect(result.current.data?.[0]?.phase).toBe("deploiement");
    expect(result.current.data?.[1]?.assignee).toBe("etablissement");
  });

  it("passe en erreur si Supabase renvoie une erreur lors du chargement des tâches", async () => {
    builderState.result = QUERY_ERROR_RESULT;
    const client = createClient();

    const { result } = renderHook(() => useClientPortalTasks("eta-1"), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("client_portal_tasks");
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.data).toBeUndefined();
  });
});

describe("useClientPortalTasksPendingCount", () => {
  beforeEach(() => {
    resetBuilderState();
  });

  it("charge puis retourne le nombre de tâches marque non terminées", async () => {
    builderState.result = COUNT_QUERY_RESULT;
    const client = createClient();

    const { result } = renderHook(() => useClientPortalTasksPendingCount("eta-1"), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("client_portal_tasks");
    expect(mockSelect).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(mockEq).toHaveBeenCalledWith("etablissement_id", "eta-1");
    expect(mockEq).toHaveBeenCalledWith("assignee", "marque");
    expect(mockNeq).toHaveBeenCalledWith("statut", "done");
    expect(builderState.selectArg).toBe("id");
    expect(builderState.selectOptions).toEqual({ count: "exact", head: true });
    expect(builderState.eqCalls).toContainEqual(["etablissement_id", "eta-1"]);
    expect(builderState.eqCalls).toContainEqual(["assignee", "marque"]);
    expect(builderState.neqCalls).toContainEqual(["statut", "done"]);
    expect(result.current.data).toBe(3);
  });

  it("passe en erreur si Supabase renvoie une erreur lors du comptage", async () => {
    builderState.result = QUERY_ERROR_RESULT;
    const client = createClient();

    const { result } = renderHook(() => useClientPortalTasksPendingCount("eta-1"), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("client_portal_tasks");
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.data).toBeUndefined();
  });
});

describe("mutations client portal tasks", () => {
  beforeEach(() => {
    resetBuilderState();
  });

  it("crée une tâche, envoie le payload enrichi et invalide les bonnes queries", async () => {
    builderState.result = CREATED_RESULT;
    const client = createClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateClientPortalTask(), {
      wrapper: createWrapper(client),
    });

    const input = {
      etablissement_id: "eta-1",
      titre: "Créer un accès",
      description: "Compte principal",
      assignee: "marque" as const,
      phase: "deploiement" as const,
      due_date: "2024-06-15",
      comment: "À faire vite",
    };

    let created: unknown;

    await act(async () => {
      created = await result.current.mutateAsync(input);
    });

    expect(created).toBe(CREATED_ROW);
    expect(mockFrom).toHaveBeenCalledWith("client_portal_tasks");
    expect(mockInsert).toHaveBeenCalledWith({
      ...input,
      created_by: "marque",
      created_by_user_id: "user-1",
      statut: "todo",
    });
    expect(mockSelect).toHaveBeenCalledWith();
    expect(mockSingle).toHaveBeenCalledOnce();
    expect(builderState.insertArg).toEqual({
      ...input,
      created_by: "marque",
      created_by_user_id: "user-1",
      statut: "todo",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Tâche créée");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["client_portal_tasks", "eta-1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["client_portal_tasks_pending_count", "eta-1"],
    });
  });

  it("met à jour une tâche, transmet le patch et invalide les bonnes queries", async () => {
    builderState.result = UPDATED_RESULT;
    const client = createClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useUpdateClientPortalTask(), {
      wrapper: createWrapper(client),
    });

    const variables = {
      id: "task-1",
      patch: {
        statut: "done" as const,
        done_by: "user-1",
      },
    };

    let updated: unknown;

    await act(async () => {
      updated = await result.current.mutateAsync(variables);
    });

    expect(updated).toBe(UPDATED_ROW);
    expect(mockFrom).toHaveBeenCalledWith("client_portal_tasks");
    expect(mockUpdate).toHaveBeenCalledWith(variables.patch);
    expect(mockEq).toHaveBeenCalledWith("id", "task-1");
    expect(mockSelect).toHaveBeenCalledWith();
    expect(mockSingle).toHaveBeenCalledOnce();
    expect(builderState.updateArg).toEqual(variables.patch);
    expect(builderState.eqCalls).toContainEqual(["id", "task-1"]);
    expect(toastSuccess).toHaveBeenCalledWith("Tâche mise à jour");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["client_portal_tasks", "eta-1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["client_portal_tasks_pending_count", "eta-1"],
    });
  });

  it("supprime une tâche avec l'id attendu et invalide les bonnes queries", async () => {
    builderState.result = DELETE_RESULT;
    const client = createClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteClientPortalTask(), {
      wrapper: createWrapper(client),
    });

    let deleted: unknown;

    await act(async () => {
      deleted = await result.current.mutateAsync({ id: "task-2", etablissement_id: "eta-1" });
    });

    expect(deleted).toEqual({ id: "task-2", etablissement_id: "eta-1" });
    expect(mockFrom).toHaveBeenCalledWith("client_portal_tasks");
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockEq).toHaveBeenCalledWith("id", "task-2");
    expect(builderState.deleteCalled).toBe(true);
    expect(builderState.eqCalls).toContainEqual(["id", "task-2"]);
    expect(toastSuccess).toHaveBeenCalledWith("Tâche supprimée");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["client_portal_tasks", "eta-1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["client_portal_tasks_pending_count", "eta-1"],
    });
  });

  it("remonte les erreurs de création en isError et appelle toast.error", async () => {
    builderState.result = MUTATION_ERROR_RESULT;
    const client = createClient();

    const { result } = renderHook(() => useCreateClientPortalTask(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          etablissement_id: "eta-1",
          titre: "Créer un accès",
          assignee: "marque",
        }),
      ).rejects.toThrow("x");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("client_portal_tasks");
    expect(mockInsert).toHaveBeenCalledWith({
      etablissement_id: "eta-1",
      titre: "Créer un accès",
      assignee: "marque",
      created_by: "marque",
      created_by_user_id: "user-1",
      statut: "todo",
    });
    expect(toastError).toHaveBeenCalledWith("x");
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});