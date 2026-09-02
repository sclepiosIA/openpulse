// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useIsDevGroupMember } from "./useIsDevGroupMember";

const {
  AUTH_STATE,
  NO_USER_AUTH_STATE,
  DEV_ROWS,
  NON_DEV_ROWS,
  FRENCH_DEV_ROWS,
  ERROR_RESULT,
  mockFrom,
  mockUseAuth,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const NO_USER_AUTH_STATE = {
    user: null,
    session: null,
    isLoading: false,
  };

  const DEV_ROWS = [
    { id: "m1", group: { name: "dev" } },
    { id: "m2", group: { name: "other" } },
  ];

  const NON_DEV_ROWS = [
    { id: "m3", group: { name: "marketing" } },
    { id: "m4", group: { name: "sales" } },
  ];

  const FRENCH_DEV_ROWS = [{ id: "m5", group: { name: "développeurs" } }];

  const ERROR_RESULT = { data: null, error: { message: "x" } };

  const mockUseAuth = vi.fn(() => AUTH_STATE);
  const mockFrom = vi.fn();

  return {
    AUTH_STATE,
    NO_USER_AUTH_STATE,
    DEV_ROWS,
    NON_DEV_ROWS,
    FRENCH_DEV_ROWS,
    ERROR_RESULT,
    mockFrom,
    mockUseAuth,
  };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createBuilder(result: QueryResult) {
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (
      onFulfilled?: ((value: QueryResult) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(result).then(onFulfilled ?? undefined, onRejected ?? undefined),
    catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(result).catch(onRejected ?? undefined),
  };

  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe("useIsDevGroupMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(AUTH_STATE);
  });

  it("expose un chargement initial puis retourne true quand l'utilisateur appartient au groupe dev", async () => {
    const builder = createBuilder({ data: DEV_ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useIsDevGroupMember(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isDevMember).toBe(false);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isDevMember).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("user_group_members");
    expect(builder.select).toHaveBeenCalledWith(`
          id,
          group:user_groups!inner(name)
        `);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("retourne false quand aucun groupe de l'utilisateur n'est dev", async () => {
    const builder = createBuilder({ data: NON_DEV_ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useIsDevGroupMember(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isDevMember).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith("user_group_members");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("retourne false quand le groupe développeurs est présent mais avec l'intitulé français reconnu", async () => {
    const builder = createBuilder({ data: FRENCH_DEV_ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useIsDevGroupMember(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isDevMember).toBe(true);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("retourne false quand Supabase renvoie une erreur métier", async () => {
    const builder = createBuilder(ERROR_RESULT);
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useIsDevGroupMember(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isDevMember).toBe(false);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isDevMember).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith("user_group_members");
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("n'exécute pas la requête quand aucun utilisateur n'est connecté", async () => {
    mockUseAuth.mockReturnValue(NO_USER_AUTH_STATE);

    const { result } = renderHook(() => useIsDevGroupMember(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isDevMember).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});