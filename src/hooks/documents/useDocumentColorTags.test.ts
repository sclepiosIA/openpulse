/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useToggleColorTag, useUpdateColorTags } from "./useDocumentColorTags";

const {
  AUTH_STATE,
  mockFrom,
  mockToastError,
  mockToastSuccess,
  mockDebugError,
  updateResult,
  insertResult,
  documentsBuilder,
  auditBuilder,
  defaultBuilder,
} = vi.hoisted(() => {
  const AUTH_STATE: {
    user: { id: string; email: string } | null;
    session: { user: { id: string } } | null;
    isLoading: boolean;
  } = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const updateResult: { data: null; error: null | { message: string } } = {
    data: null,
    error: null,
  };

  const insertResult: { data: null; error: null | { message: string } } = {
    data: null,
    error: null,
  };

  const createBuilder = () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then: vi.fn(),
      catch: vi.fn(),
    };

    builder.select.mockImplementation(() => builder);
    builder.eq.mockImplementation(() => builder);
    builder.gte.mockImplementation(() => builder);
    builder.lte.mockImplementation(() => builder);
    builder.in.mockImplementation(() => builder);
    builder.order.mockImplementation(() => builder);
    builder.limit.mockImplementation(() => builder);
    builder.delete.mockImplementation(() => builder);
    builder.update.mockImplementation(() => builder);
    builder.insert.mockImplementation(() => builder);
    builder.single.mockResolvedValue({ data: null, error: null });
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    builder.catch.mockImplementation(() => builder);

    return builder;
  };

  const documentsBuilder = createBuilder();
  const auditBuilder = createBuilder();
  const defaultBuilder = createBuilder();

  documentsBuilder.then.mockImplementation(
    (resolve: (value: { data: null; error: null | { message: string } }) => unknown) =>
      Promise.resolve(resolve(updateResult)),
  );

  auditBuilder.then.mockImplementation(
    (resolve: (value: { data: null; error: null | { message: string } }) => unknown) =>
      Promise.resolve(resolve(insertResult)),
  );

  defaultBuilder.then.mockImplementation(
    (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: null, error: null })),
  );

  const mockFrom = vi.fn((table: string) => {
    if (table === "documents") return documentsBuilder;
    if (table === "document_audit_log") return auditBuilder;
    return defaultBuilder;
  });

  const mockToastError = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockDebugError = vi.fn();

  return {
    AUTH_STATE,
    mockFrom,
    mockToastError,
    mockToastSuccess,
    mockDebugError,
    updateResult,
    insertResult,
    documentsBuilder,
    auditBuilder,
    defaultBuilder,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient, invalidateSpy };
}

describe("useDocumentColorTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateResult.error = null;
    insertResult.error = null;
    AUTH_STATE.user = { id: "u1", email: "t@t.co" };
    AUTH_STATE.session = { user: { id: "u1" } };
  });

  it("useUpdateColorTags démarre non pending puis met à jour les tags, écrit l'audit et invalide documents", async () => {
    const { Wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useUpdateColorTags(), { wrapper: Wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);

    await act(async () => {
      await result.current.mutateAsync({
        documentId: "doc-1",
        colorTags: ["red", "blue"],
      });
    });

    expect(mockFrom).toHaveBeenCalledWith("documents");
    expect(documentsBuilder.update).toHaveBeenCalledWith({ color_tags: ["red", "blue"] });
    expect(documentsBuilder.eq).toHaveBeenCalledWith("id", "doc-1");

    expect(mockFrom).toHaveBeenCalledWith("document_audit_log");
    expect(auditBuilder.insert).toHaveBeenCalledWith({
      document_id: "doc-1",
      action: "tagged",
      performed_by: "u1",
      new_value: { color_tags: ["red", "blue"] },
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["documents"] });
    });

    expect(mockDebugError).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("useUpdateColorTags passe en erreur si la mise à jour Supabase échoue", async () => {
    const { Wrapper } = createWrapper();
    updateResult.error = { message: "x" };

    const { result } = renderHook(() => useUpdateColorTags(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          documentId: "doc-2",
          colorTags: ["green"],
        }),
      ).rejects.toEqual({ message: "x" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(documentsBuilder.update).toHaveBeenCalledWith({ color_tags: ["green"] });
    expect(documentsBuilder.eq).toHaveBeenCalledWith("id", "doc-2");
    expect(auditBuilder.insert).not.toHaveBeenCalled();
    expect(mockDebugError).toHaveBeenCalledWith("Erreur mise à jour tags colorés:", { message: "x" });
    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la mise à jour des tags");
  });

  it("useUpdateColorTags passe en erreur si l'utilisateur n'est pas authentifié", async () => {
    const { Wrapper } = createWrapper();
    AUTH_STATE.user = null;
    AUTH_STATE.session = null;

    const { result } = renderHook(() => useUpdateColorTags(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          documentId: "doc-3",
          colorTags: ["yellow"],
        }),
      ).rejects.toThrow("Non authentifié");
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la mise à jour des tags");
    expect(mockDebugError).toHaveBeenCalled();
  });

  it("useToggleColorTag ajoute un tag absent", async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useToggleColorTag(), { wrapper: Wrapper });

    expect(result.current.isPending).toBe(false);

    await act(async () => {
      result.current.toggleTag("doc-4", ["red"], "blue");
    });

    await waitFor(() => {
      expect(documentsBuilder.update).toHaveBeenCalledWith({ color_tags: ["red", "blue"] });
    });

    expect(documentsBuilder.eq).toHaveBeenCalledWith("id", "doc-4");
    expect(auditBuilder.insert).toHaveBeenCalledWith({
      document_id: "doc-4",
      action: "tagged",
      performed_by: "u1",
      new_value: { color_tags: ["red", "blue"] },
    });
  });

  it("useToggleColorTag retire un tag déjà présent", async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useToggleColorTag(), { wrapper: Wrapper });

    await act(async () => {
      result.current.toggleTag("doc-5", ["red", "blue"], "blue");
    });

    await waitFor(() => {
      expect(documentsBuilder.update).toHaveBeenCalledWith({ color_tags: ["red"] });
    });

    expect(documentsBuilder.eq).toHaveBeenCalledWith("id", "doc-5");
    expect(auditBuilder.insert).toHaveBeenCalledWith({
      document_id: "doc-5",
      action: "tagged",
      performed_by: "u1",
      new_value: { color_tags: ["red"] },
    });
  });
});