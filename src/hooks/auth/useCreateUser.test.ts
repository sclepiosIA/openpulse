/* @vitest-environment jsdom */
import React, { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCreateUser } from "./useCreateUser";

const {
  mockInvoke,
  mockFrom,
  mockUpdate,
  mockEq,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  mockDebugError,
  SUCCESS_RESULT,
  AUTH_USER,
} = vi.hoisted(() => {
  const updateResult = Promise.resolve({ error: null });
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
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  const successResult = {
    success: true,
    user: {
      id: "user-1",
      email: "new.user@example.com",
    },
  };

  return {
    mockInvoke: vi.fn(),
    mockFrom: vi.fn(() => builder),
    mockUpdate: builder.update,
    mockEq: builder.eq,
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockSanitizeSupabaseError: vi.fn((error: Error) => `sanitized:${error.message}`),
    mockDebugError: vi.fn(),
    SUCCESS_RESULT: successResult,
    AUTH_USER: {
      user: { id: "u1", email: "t@t.co" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_USER,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useCreateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expose un état initial non chargé puis crée un utilisateur, met à jour le profil et invalide les queries", async () => {
    mockInvoke.mockResolvedValue({
      data: SUCCESS_RESULT,
      error: null,
    });
    mockFrom.mockImplementation(() => ({
      select: vi.fn(function () { return this; }),
      eq: mockEq,
      gte: vi.fn(function () { return this; }),
      lte: vi.fn(function () { return this; }),
      in: vi.fn(function () { return this; }),
      order: vi.fn(function () { return this; }),
      limit: vi.fn(function () { return this; }),
      insert: vi.fn(function () { return this; }),
      update: mockUpdate,
      delete: vi.fn(function () { return this; }),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }));
    mockUpdate.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockResolvedValue({ error: null });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeUndefined();

    const payload = {
      email: "new.user@example.com",
      prenom: "Jean",
      nom: "Dupont",
      role: "commercial" as const,
      password: "pwd-123",
      fonction: "Account Executive",
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockInvoke).toHaveBeenCalledWith("admin-create-user", {
      body: {
        email: "new.user@example.com",
        prenom: "Jean",
        nom: "Dupont",
        role: "commercial",
        password: "pwd-123",
      },
    });

    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockUpdate).toHaveBeenCalledWith({ fonction: "Account Executive" });
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");

    expect(result.current.data).toEqual(SUCCESS_RESULT);
    expect(result.current.data?.user?.email).toBe("new.user@example.com");

    expect(mockToastSuccess).toHaveBeenCalledWith("Utilisateur créé", {
      description: "new.user@example.com a été créé. Communiquez-lui son mot de passe initial.",
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockDebugError).not.toHaveBeenCalled();
  });

  it("crée un utilisateur sans fonction et ne tente pas de mettre à jour le profil", async () => {
    mockInvoke.mockResolvedValue({
      data: SUCCESS_RESULT,
      error: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        email: "new.user@example.com",
        prenom: "Lina",
        nom: "Martin",
        role: "rh",
        password: "pwd-456",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockInvoke).toHaveBeenCalledWith("admin-create-user", {
      body: {
        email: "new.user@example.com",
        prenom: "Lina",
        nom: "Martin",
        role: "rh",
        password: "pwd-456",
      },
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
  });

  it("passe en erreur quand l'edge function renvoie une erreur HTTP et affiche le message sanitizé", async () => {
    const httpError = { message: "http failed" };
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          email: "bad.user@example.com",
          prenom: "Bad",
          nom: "User",
          role: "admin",
          password: "pwd-789",
        }),
      ).rejects.toEqual(httpError);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(httpError);
    expect(mockToastError).toHaveBeenCalledWith("sanitized:http failed");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("passe en erreur quand l'edge function renvoie une erreur applicative", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: false,
        error: "Email déjà utilisé",
        details: { field: "email" },
      },
      error: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          email: "existing.user@example.com",
          prenom: "Eva",
          nom: "Durand",
          role: "direction",
          password: "pwd-app",
        }),
      ).rejects.toThrow("Email déjà utilisé");
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    const sanitizeArg = mockSanitizeSupabaseError.mock.calls[0]?.[0] as Error & {
      details?: unknown;
      isApplicationError?: boolean;
    };
    expect(sanitizeArg.message).toBe("Email déjà utilisé");
    expect(sanitizeArg.details).toEqual({ field: "email" });
    expect(sanitizeArg.isApplicationError).toBe(true);
    expect(mockToastError).toHaveBeenCalledWith("sanitized:Email déjà utilisé");
  });

  it("journalise une erreur de mise à jour du profil sans faire échouer la création", async () => {
    const profileError = { message: "profile update failed" };

    mockInvoke.mockResolvedValue({
      data: SUCCESS_RESULT,
      error: null,
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn(function () { return this; }),
      eq: mockEq,
      gte: vi.fn(function () { return this; }),
      lte: vi.fn(function () { return this; }),
      in: vi.fn(function () { return this; }),
      order: vi.fn(function () { return this; }),
      limit: vi.fn(function () { return this; }),
      insert: vi.fn(function () { return this; }),
      update: mockUpdate,
      delete: vi.fn(function () { return this; }),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }));
    mockUpdate.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockResolvedValue({ error: profileError });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        email: "new.user@example.com",
        prenom: "Noa",
        nom: "Petit",
        role: "csm",
        password: "pwd-log",
        fonction: "CSM Senior",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockDebugError).toHaveBeenCalledWith(
      "Erreur lors de la mise à jour du profil:",
      profileError,
    );
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(SUCCESS_RESULT);
  });
});