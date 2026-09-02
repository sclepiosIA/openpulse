import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

const { AUTH_STATE, toast, mockFrom, mockRpc, buildThenableBuilder, REQUESTS_OK, USERS_OK, RPC_CREATE_OK, RPC_RESET_OK, lastBuilder } =
  vi.hoisted(() => {
    const AUTH_STATE = {
      user: { id: "u1", email: "t@t.co" },
      session: { user: { id: "u1" } },
      isLoading: false,
    };

    const toast = {
      success: vi.fn(),
      error: vi.fn(),
    };

    type SupabaseResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

    type BuilderConfig = {
      result: SupabaseResult<unknown>;
    };

    function buildThenableBuilder(config: BuilderConfig) {
      const state = {
        filters: [] as Array<{ col: string; value: unknown }>,
        updates: null as unknown,
        orderBy: null as { column: string; ascending: boolean } | null,
        limitCount: null as number | null,
        selectArg: null as string | null,
        table: null as string | null,
      };

      const builder = {
        _state: state,
        select: (arg: string) => {
          state.selectArg = arg;
          return builder;
        },
        eq: (col: string, value: unknown) => {
          state.filters.push({ col, value });
          return builder;
        },
        gte: (col: string, value: unknown) => {
          state.filters.push({ col, value });
          return builder;
        },
        lte: (col: string, value: unknown) => {
          state.filters.push({ col, value });
          return builder;
        },
        in: (col: string, value: unknown[]) => {
          state.filters.push({ col, value });
          return builder;
        },
        order: (column: string, opts?: { ascending?: boolean }) => {
          state.orderBy = { column, ascending: opts?.ascending ?? true };
          return builder;
        },
        limit: (count: number) => {
          state.limitCount = count;
          return builder;
        },
        insert: (_values: unknown) => builder,
        update: (values: unknown) => {
          state.updates = values;
          return builder;
        },
        delete: () => builder,
        single: () => config.result,
        maybeSingle: () => config.result,
        then: <TResult1 = unknown, TResult2 = never>(
          onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) => config.result.then(onfulfilled, onrejected),
        catch: <TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null) => config.result.catch(onrejected),
      };

      return builder;
    }

    const lastBuilder: { current: ReturnType<typeof buildThenableBuilder> | null } = { current: null };

    const USERS_OK = [
      {
        id: "cpu_1",
        email: "a@b.co",
        full_name: "Alice Doe",
        nom: "Doe",
        prenom: "Alice",
        etablissement_id: "etab_1",
        etablissement_nom: "Etab 1",
        actif: true,
        last_login: null,
        created_at: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "cpu_2",
        email: "c@d.co",
        full_name: "Bob Smith",
        nom: "Smith",
        prenom: "Bob",
        etablissement_id: "etab_2",
        etablissement_nom: "Etab 2",
        actif: false,
        last_login: "2024-02-01T00:00:00.000Z",
        created_at: "2024-01-10T00:00:00.000Z",
      },
    ];

    const REQUESTS_OK = [
      {
        id: "r1",
        user_id: "cpu_1",
        etablissement_id: "etab_1",
        email: "a@b.co",
        type: "contact",
        sujet: "Besoin d'aide",
        message: "Bonjour",
        statut: "nouveau",
        handled_by: null,
        handled_at: null,
        created_at: "2024-03-01T10:00:00.000Z",
      },
      {
        id: "r2",
        user_id: null,
        etablissement_id: "etab_2",
        email: "c@d.co",
        type: "facture",
        sujet: "Facture",
        message: "Question",
        statut: "traite",
        handled_by: "u9",
        handled_at: "2024-03-02T10:00:00.000Z",
        created_at: "2024-03-02T10:00:00.000Z",
      },
    ];

    const RPC_CREATE_OK = [{ user_id: "cpu_new", temp_password: "tmp-pass-1" }];
    const RPC_RESET_OK = [{ temp_password: "tmp-pass-2" }];

    const mockRpc = vi.fn((_fnName: string, _args?: Record<string, unknown>) =>
      Promise.resolve({ data: null, error: { message: "rpc not configured" } }),
    );

    const mockFrom = vi.fn((table: string) => {
      const builder = buildThenableBuilder({
        result: Promise.resolve({ data: [], error: null }),
      });
      builder._state.table = table;
      lastBuilder.current = builder;
      return builder;
    });

    return {
      AUTH_STATE,
      toast,
      mockFrom,
      mockRpc,
      buildThenableBuilder,
      USERS_OK,
      REQUESTS_OK,
      RPC_CREATE_OK,
      RPC_RESET_OK,
      lastBuilder,
    };
  });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("sonner", () => ({
  toast,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const Wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient };
}

async function importModule() {
  return await import("./useClientPortal");
}

describe("useClientPortal.ts", () => {
  it("useClientPortalUsers: loading -> success (RPC)", async () => {
    const { useClientPortalUsers } = await importModule();

    mockRpc.mockImplementationOnce((fnName: string) => {
      if (fnName === "list_client_portal_users") return Promise.resolve({ data: USERS_OK, error: null });
      return Promise.resolve({ data: null, error: { message: "unexpected rpc" } });
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClientPortalUsers(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith("list_client_portal_users");
    expect(result.current.data?.map((u) => u.id)).toEqual(["cpu_1", "cpu_2"]);
    expect(result.current.data?.[1]?.actif).toBe(false);
    expect(result.current.data?.[0]?.etablissement_id).toBe("etab_1");
  });

  it("useClientPortalUsersByEtablissement: disabled sans etablissementId, puis filtre côté client", async () => {
    const { useClientPortalUsersByEtablissement } = await importModule();

    const { Wrapper } = createWrapper();
    const { result, rerender } = renderHook(({ etab }: { etab?: string }) => useClientPortalUsersByEtablissement(etab), {
      wrapper: Wrapper,
      initialProps: { etab: undefined },
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isFetching).toBe(false);
    expect(result.current.isSuccess).toBe(false);

    mockRpc.mockImplementationOnce((fnName: string) => {
      if (fnName === "list_client_portal_users") return Promise.resolve({ data: USERS_OK, error: null });
      return Promise.resolve({ data: null, error: { message: "unexpected rpc" } });
    });

    rerender({ etab: "etab_1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((u) => u.id)).toEqual(["cpu_1"]);
    expect(result.current.data?.[0]?.email).toBe("a@b.co");
    expect(mockRpc).toHaveBeenCalledWith("list_client_portal_users");
  });

  it("useClientPortalUsers: erreur RPC -> isError", async () => {
    const { useClientPortalUsers } = await importModule();

    mockRpc.mockImplementationOnce((fnName: string) => {
      if (fnName === "list_client_portal_users") return Promise.resolve({ data: null, error: { message: "x" } });
      return Promise.resolve({ data: null, error: { message: "unexpected rpc" } });
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClientPortalUsers(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(String((result.current.error as Error).message)).toContain("x");
  });

  it("useCreateClientPortalUser: mapping args, invalidate, toast success", async () => {
    const { useCreateClientPortalUser } = await importModule();

    mockRpc.mockImplementationOnce((fnName: string, args?: Record<string, unknown>) => {
      if (fnName === "create_client_portal_user") {
        expect(args).toEqual({
          p_email: "new@b.co",
          p_full_name: "New User",
          p_etablissement_id: "etab_9",
        });
        return Promise.resolve({ data: RPC_CREATE_OK, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unexpected rpc" } });
    });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateClientPortalUser(), { wrapper: Wrapper });

    await act(async () => {
      const out = await result.current.mutateAsync({
        email: "new@b.co",
        full_name: "New User",
        etablissement_id: "etab_9",
      });
      expect(out.user_id).toBe("cpu_new");
      expect(out.temp_password).toBe("tmp-pass-1");
    });

    expect(mockRpc).toHaveBeenCalledWith("create_client_portal_user", {
      p_email: "new@b.co",
      p_full_name: "New User",
      p_etablissement_id: "etab_9",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["client_portal_users"] });
    expect(toast.success).toHaveBeenCalledWith("Compte portail créé");
  });

  it("useResetClientPortalPassword: erreur RPC -> toast.error", async () => {
    const { useResetClientPortalPassword } = await importModule();

    mockRpc.mockImplementationOnce((fnName: string) => {
      if (fnName === "reset_client_portal_password") return Promise.resolve({ data: null, error: { message: "x" } });
      return Promise.resolve({ data: null, error: { message: "unexpected rpc" } });
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useResetClientPortalPassword(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync("cpu_1")).rejects.toBeTruthy();
    });

    expect(mockRpc).toHaveBeenCalledWith("reset_client_portal_password", { p_user_id: "cpu_1" });
    expect(toast.error).toHaveBeenCalledWith("x");
  });

  it("useClientPortalRequests: succès + filtres -> eq, order, limit", async () => {
    const { useClientPortalRequests } = await importModule();

    const builder = buildThenableBuilder({
      result: Promise.resolve({ data: REQUESTS_OK, error: null }),
    });

    mockFrom.mockImplementationOnce((table: string) => {
      builder._state.table = table;
      lastBuilder.current = builder;
      return builder;
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClientPortalRequests({ etablissementId: "etab_1", statut: "nouveau" }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("client_portal_requests");
    expect(lastBuilder.current?._state.selectArg).toBe("*");
    expect(lastBuilder.current?._state.orderBy).toEqual({ column: "created_at", ascending: false });
    expect(lastBuilder.current?._state.limitCount).toBe(500);
    expect(lastBuilder.current?._state.filters).toEqual([
      { col: "etablissement_id", value: "etab_1" },
      { col: "statut", value: "nouveau" },
    ]);
    expect(result.current.data?.[0]?.id).toBe("r1");
    expect(result.current.data?.[0]?.sujet).toBe("Besoin d'aide");
  });

  it("useClientPortalRequests: erreur -> isError", async () => {
    const { useClientPortalRequests } = await importModule();

    const builder = buildThenableBuilder({
      result: Promise.resolve({ data: null, error: { message: "x" } }),
    });

    mockFrom.mockImplementationOnce((table: string) => {
      builder._state.table = table;
      lastBuilder.current = builder;
      return builder;
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClientPortalRequests(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("client_portal_requests");
    expect(String((result.current.error as Error).message)).toContain("x");
  });

  it("useUpdateClientPortalRequest: update ferme -> handled_* set, invalidate, toast", async () => {
    const { useUpdateClientPortalRequest } = await importModule();

    const builder = buildThenableBuilder({
      result: Promise.resolve({ data: [], error: null }),
    });

    mockFrom.mockImplementationOnce((table: string) => {
      builder._state.table = table;
      lastBuilder.current = builder;
      return builder;
    });

    const dateSpy = vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-05-01T00:00:00.000Z");

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateClientPortalRequest(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: "r1", statut: "ferme" });
    });

    expect(mockFrom).toHaveBeenCalledWith("client_portal_requests");
    expect(lastBuilder.current?._state.updates).toEqual({
      statut: "ferme",
      handled_at: "2024-05-01T00:00:00.000Z",
      handled_by: "u1",
    });
    expect(lastBuilder.current?._state.filters).toEqual([{ col: "id", value: "r1" }]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["client_portal_requests"] });
    expect(toast.success).toHaveBeenCalledWith("Demande mise à jour");

    dateSpy.mockRestore();
  });

  it("useUpdateClientPortalRequest: erreur update -> toast.error", async () => {
    const { useUpdateClientPortalRequest } = await importModule();

    const builder = buildThenableBuilder({
      result: Promise.resolve({ data: null, error: { message: "x" } }),
    });

    mockFrom.mockImplementationOnce((table: string) => {
      builder._state.table = table;
      lastBuilder.current = builder;
      return builder;
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateClientPortalRequest(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: "r1", statut: "en_cours" })).rejects.toBeTruthy();
    });

    expect(toast.error).toHaveBeenCalledWith("x");
  });
});