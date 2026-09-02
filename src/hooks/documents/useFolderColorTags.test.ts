/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUpdateFolderColorTags, useToggleFolderColorTag } from "./useFolderColorTags";

const {
  AUTH_STATE,
  mockFrom,
  toastError,
  toastSuccess,
  debugError,
  invalidateQueriesMock,
  builder,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const builderState: {
    result: { data: null; error: null | { message: string } } | Promise<{ data: null; error: null | { message: string } }>;
  } = {
    result: { data: null, error: null },
  };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => Promise.resolve(builderState.result)),
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
    then: (onFulfilled: (value: { data: null; error: null | { message: string } }) => unknown) =>
      Promise.resolve(builderState.result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(builderState.result).catch(onRejected),
    __setResult: (next: { data: null; error: null | { message: string } } | Promise<{ data: null; error: null | { message: string } }>) => {
      builderState.result = next;
    },
    __reset: () => {
      builderState.result = { data: null, error: null };
      builder.select.mockClear();
      builder.eq.mockClear();
      builder.gte.mockClear();
      builder.lte.mockClear();
      builder.in.mockClear();
      builder.order.mockClear();
      builder.limit.mockClear();
      builder.insert.mockClear();
      builder.update.mockClear();
      builder.delete.mockClear();
      builder.single.mockClear();
      builder.maybeSingle.mockClear();
    },
  };

  const mockFrom = vi.fn(() => builder);
  const toastError = vi.fn();
  const toastSuccess = vi.fn();
  const debugError = vi.fn();
  const invalidateQueriesMock = vi.fn();

  return {
    AUTH_STATE,
    mockFrom,
    toastError,
    toastSuccess,
    debugError,
    invalidateQueriesMock,
    builder,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  vi.spyOn(queryClient, "invalidateQueries").mockImplementation(invalidateQueriesMock);

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe("useFolderColorTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    builder.__reset();
  });

  it("met à jour les tags couleur puis invalide la query des dossiers", async () => {
    builder.__setResult({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateFolderColorTags(), { wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isIdle).toBe(true);

    await act(async () => {
      result.current.mutate({ folderId: "folder-1", colorTags: ["red", "blue"] });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("document_folders");
    expect(builder.update).toHaveBeenCalledWith({ color_tags: ["red", "blue"] });
    expect(builder.eq).toHaveBeenCalledWith("id", "folder-1");
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["document-folders"] });
    expect(debugError).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("expose isPending pendant la mutation puis revient à false après succès", async () => {
    let resolveMutation: ((value: { data: null; error: null }) => void) | undefined;

    builder.__setResult(
      new Promise<{ data: null; error: null }>((resolve) => {
        resolveMutation = resolve;
      }),
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateFolderColorTags(), { wrapper });

    act(() => {
      result.current.mutate({ folderId: "folder-2", colorTags: ["green"] });
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      if (resolveMutation) {
        resolveMutation({ data: null, error: null });
      }
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isPending).toBe(false);
    });

    expect(builder.update).toHaveBeenCalledWith({ color_tags: ["green"] });
    expect(builder.eq).toHaveBeenCalledWith("id", "folder-2");
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["document-folders"] });
  });

  it("passe en erreur si supabase renvoie une erreur et notifie debug + toast", async () => {
    const supabaseError = { message: "x" };
    builder.__setResult({ data: null, error: supabaseError });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateFolderColorTags(), { wrapper });

    await act(async () => {
      result.current.mutate({ folderId: "folder-err", colorTags: ["yellow"] });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("document_folders");
    expect(builder.update).toHaveBeenCalledWith({ color_tags: ["yellow"] });
    expect(builder.eq).toHaveBeenCalledWith("id", "folder-err");
    expect(debugError).toHaveBeenCalledWith("Erreur mise à jour tags colorés dossier:", supabaseError);
    expect(toastError).toHaveBeenCalledWith("Erreur lors de la mise à jour des tags");
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });

  it("toggleTag ajoute un tag absent", async () => {
    builder.__setResult({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useToggleFolderColorTag(), { wrapper });

    expect(result.current.isPending).toBe(false);

    await act(async () => {
      result.current.toggleTag("folder-3", ["red"], "blue");
    });

    await waitFor(() => {
      expect(builder.update).toHaveBeenCalledWith({ color_tags: ["red", "blue"] });
    });

    expect(mockFrom).toHaveBeenCalledWith("document_folders");
    expect(builder.eq).toHaveBeenCalledWith("id", "folder-3");
  });

  it("toggleTag retire un tag déjà présent", async () => {
    builder.__setResult({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useToggleFolderColorTag(), { wrapper });

    await act(async () => {
      result.current.toggleTag("folder-4", ["red", "blue"], "blue");
    });

    await waitFor(() => {
      expect(builder.update).toHaveBeenCalledWith({ color_tags: ["red"] });
    });

    expect(builder.eq).toHaveBeenCalledWith("id", "folder-4");
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["document-folders"] });
  });
});