/* @vitest-environment jsdom */
import React, { PropsWithChildren } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDocumentQuota } from "./useDocumentQuota";

const {
  DOC_ROWS,
  AUTH_STATE,
  FORMAT_FILE_SIZE,
  mockFrom,
} = vi.hoisted(() => {
  const DOC_ROWS = [
    { file_size_bytes: 1024 },
    { file_size_bytes: 2048 },
    { file_size_bytes: 0 },
    { file_size_bytes: null },
  ];
  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };
  const FORMAT_FILE_SIZE = vi.fn((value: number) => `${value} B`);
  const mockFrom = vi.fn();

  return {
    DOC_ROWS,
    AUTH_STATE,
    FORMAT_FILE_SIZE,
    mockFrom,
  };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock("@/types/documents", () => ({
  formatFileSize: FORMAT_FILE_SIZE,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createThenableResult<T>(result: T) {
  return {
    then: (onFulfilled?: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
}

function createBuilder(result: { data: unknown; error: unknown }) {
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
    is: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: createThenableResult(result).then,
    catch: createThenableResult(result).catch,
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

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useDocumentQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AUTH_STATE.user = { id: "u1", email: "t@t.co" };
    AUTH_STATE.session = { user: { id: "u1" } };
    AUTH_STATE.isLoading = false;
  });

  it("expose un état de chargement puis calcule correctement le quota et formate les tailles", async () => {
    const builder = createBuilder({ data: DOC_ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useDocumentQuota(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const quotaBytes = 5 * 1024 * 1024 * 1024;
    const usedBytes = 1024 + 2048;
    const availableBytes = quotaBytes - usedBytes;
    const usagePercentage = (usedBytes / quotaBytes) * 100;

    expect(mockFrom).toHaveBeenCalledWith("documents");
    expect(builder.select).toHaveBeenCalledWith("file_size_bytes");
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builder.eq).toHaveBeenCalledWith("is_hard_deleted", false);

    expect(result.current.data).toEqual({
      quota_bytes: quotaBytes,
      used_bytes: usedBytes,
      available_bytes: availableBytes,
      usage_percentage: usagePercentage,
      formatted_quota: `${quotaBytes} B`,
      formatted_used: `${usedBytes} B`,
      formatted_available: `${availableBytes} B`,
    });

    expect(FORMAT_FILE_SIZE).toHaveBeenCalledTimes(3);
    expect(FORMAT_FILE_SIZE).toHaveBeenNthCalledWith(1, quotaBytes);
    expect(FORMAT_FILE_SIZE).toHaveBeenNthCalledWith(2, usedBytes);
    expect(FORMAT_FILE_SIZE).toHaveBeenNthCalledWith(3, availableBytes);
  });

  it("renvoie une erreur si l'utilisateur n'est pas authentifié", async () => {
    AUTH_STATE.user = null;
    AUTH_STATE.session = null;

    const builder = createBuilder({ data: DOC_ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useDocumentQuota(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("Non authentifié");
    expect(mockFrom).not.toHaveBeenCalled();
    expect(FORMAT_FILE_SIZE).not.toHaveBeenCalled();
  });

  it("renvoie des valeurs nulles implicites si supabase retourne data null", async () => {
    const builder = createBuilder({ data: null, error: { message: "x" } });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useDocumentQuota(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const quotaBytes = 5 * 1024 * 1024 * 1024;

    expect(result.current.data).toEqual({
      quota_bytes: quotaBytes,
      used_bytes: 0,
      available_bytes: quotaBytes,
      usage_percentage: 0,
      formatted_quota: `${quotaBytes} B`,
      formatted_used: "0 B",
      formatted_available: `${quotaBytes} B`,
    });

    expect(mockFrom).toHaveBeenCalledWith("documents");
  });
});