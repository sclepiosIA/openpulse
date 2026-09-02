// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAdminResetPassword, generateSecurePassword } from "./useAdminResetPassword";

const {
  mockInvoke,
  mockFrom,
  mockSanitizeSupabaseError,
  mockCreateApplicationError,
  mockToastSuccess,
  mockToastError,
  SUCCESS_RESULT,
  FUNCTION_ERROR,
  APP_ERROR_RESULT,
  APP_ERROR_OBJECT,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFrom: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  mockCreateApplicationError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  SUCCESS_RESULT: {
    success: true,
    message: "Réinitialisation effectuée",
  },
  FUNCTION_ERROR: {
    message: "x",
  },
  APP_ERROR_RESULT: {
    success: false,
    error: "Mot de passe invalide",
    details: { code: "weak" },
  },
  APP_ERROR_OBJECT: new Error("application error"),
}));

vi.mock("@/integrations/supabase/client", () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  mockFrom.mockReturnValue(builder);

  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: mockInvoke,
      },
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock("@/types/admin", () => ({
  createApplicationError: mockCreateApplicationError,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, invalidateQueriesSpy };
}

describe("useAdminResetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitizeSupabaseError.mockReturnValue("Erreur nettoyée");
    mockCreateApplicationError.mockReturnValue(APP_ERROR_OBJECT);
  });

  it("passe par isPending puis réussit, retourne le résultat métier, affiche un toast et invalide les queries attendues", async () => {
    let resolvePromise:
      | ((value: { data: typeof SUCCESS_RESULT; error: null }) => void)
      | undefined;

    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );

    const { Wrapper, invalidateQueriesSpy } = createWrapper();

    const { result } = renderHook(() => useAdminResetPassword(), {
      wrapper: Wrapper,
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isIdle).toBe(true);

    act(() => {
      result.current.mutate({
        userId: "user-1",
        newPassword: "Ab2!",
      });
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      if (resolvePromise) {
        resolvePromise({
          data: SUCCESS_RESULT,
          error: null,
        });
      }
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("admin-reset-user-password", {
      body: {
        userId: "user-1",
        newPassword: "Ab2!",
      },
    });

    expect(result.current.data).toEqual(SUCCESS_RESULT);
    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.message).toBe("Réinitialisation effectuée");

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith("Mot de passe réinitialisé", {
      description: "Réinitialisation effectuée",
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["profiles"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["profilesWithRoles"] });

    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockSanitizeSupabaseError).not.toHaveBeenCalled();
  });

  it("met la mutation en erreur quand supabase functions.invoke renvoie { data:null, error } et affiche le message sanitizé", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: FUNCTION_ERROR,
    });

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useAdminResetPassword(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          userId: "user-2",
          newPassword: "Cd3@",
        })
      ).rejects.toEqual(FUNCTION_ERROR);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(FUNCTION_ERROR);
    expect(mockSanitizeSupabaseError).toHaveBeenCalledTimes(1);
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(FUNCTION_ERROR);
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith("Erreur nettoyée");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("transforme une erreur métier renvoyée par la fonction en application error puis la remonte en isError", async () => {
    mockInvoke.mockResolvedValue({
      data: APP_ERROR_RESULT,
      error: null,
    });

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useAdminResetPassword(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          userId: "user-3",
          newPassword: "Ef4#",
        })
      ).rejects.toBe(APP_ERROR_OBJECT);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockCreateApplicationError).toHaveBeenCalledTimes(1);
    expect(mockCreateApplicationError).toHaveBeenCalledWith(
      "Mot de passe invalide",
      APP_ERROR_RESULT.details
    );
    expect(result.current.error).toBe(APP_ERROR_OBJECT);
    expect(mockSanitizeSupabaseError).toHaveBeenCalledTimes(1);
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(APP_ERROR_OBJECT);
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith("Erreur nettoyée");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

describe("generateSecurePassword", () => {
  it("utilise un CSPRNG sans dépendre de Math.random", () => {
    const mathRandom = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random interdit");
    });
    const cryptoRandom = vi.spyOn(globalThis.crypto, "getRandomValues");

    try {
      expect(() => generateSecurePassword()).not.toThrow();
      expect(cryptoRandom).toHaveBeenCalled();
    } finally {
      mathRandom.mockRestore();
      cryptoRandom.mockRestore();
    }
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 3, 129])(
    "refuse une longueur non bornée ou hors limites : %s",
    (length) => {
      expect(() => generateSecurePassword(length)).toThrow(RangeError);
    }
  );

  it("génère un mot de passe de longueur 12 par défaut avec les catégories attendues", () => {
    const password = generateSecurePassword();

    expect(password).toHaveLength(12);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[2-9]/);
    expect(password).toMatch(/[!@#$%&*]/);
    expect(password).not.toMatch(/[ILO]/);
    expect(password).not.toMatch(/[ilo]/);
    expect(password).not.toMatch(/[01]/);
  });

  it("respecte la longueur demandée et conserve au moins une majuscule, une minuscule, un chiffre et un caractère spécial", () => {
    const password = generateSecurePassword(16);

    expect(password).toHaveLength(16);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[2-9]/);
    expect(password).toMatch(/[!@#$%&*]/);
  });
});