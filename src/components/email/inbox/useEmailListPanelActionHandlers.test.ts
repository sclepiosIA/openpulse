/* @vitest-environment jsdom */
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEmailListPanelActionHandlers } from "./useEmailListPanelActionHandlers";

const {
  THREADS,
  AUTH_STATE,
  mockMarkAsRead,
  mockToggleStar,
  mockMarkAsProcessed,
  mockArchiveThread,
  mockDeleteThread,
  mockMarkAsSpam,
  mockUpdateTags,
  mockNavigate,
  mockFrom,
  mockUseEmailThreadActions,
} = vi.hoisted(() => {
  const createBuilder = () => {
    const result = { data: null, error: null as null | { message: string } };
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
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    };
    return builder;
  };

  return {
    THREADS: [
      {
        id: "t1",
        unread_count: 1,
        priority: null,
        is_processed: false,
        tags: ["inbox"],
        subject: "First",
      },
      {
        id: "t2",
        unread_count: 0,
        priority: "high",
        is_processed: true,
        tags: ["work"],
        subject: "Second",
      },
    ],
    AUTH_STATE: {
      user: { id: "u1", email: "user@test.co" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    mockMarkAsRead: vi.fn(),
    mockToggleStar: vi.fn(),
    mockMarkAsProcessed: vi.fn(),
    mockArchiveThread: vi.fn(),
    mockDeleteThread: vi.fn(),
    mockMarkAsSpam: vi.fn(),
    mockUpdateTags: vi.fn(),
    mockNavigate: vi.fn(),
    mockFrom: vi.fn(() => createBuilder()),
    mockUseEmailThreadActions: vi.fn(() => ({
      markAsRead: vi.fn(),
      toggleStar: vi.fn(),
      markAsProcessed: vi.fn(),
      archiveThread: vi.fn(),
      deleteThread: vi.fn(),
      markAsSpam: vi.fn(),
      updateTags: vi.fn(),
    })),
  };
});

vi.mock("@/hooks/email/useEmailThreadActions", () => ({
  useEmailThreadActions: mockUseEmailThreadActions,
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createWrapper(): React.ComponentType<{ children: React.ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useEmailListPanelActionHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEmailThreadActions.mockReturnValue({
      markAsRead: mockMarkAsRead,
      toggleStar: mockToggleStar,
      markAsProcessed: mockMarkAsProcessed,
      archiveThread: mockArchiveThread,
      deleteThread: mockDeleteThread,
      markAsSpam: mockMarkAsSpam,
      updateTags: mockUpdateTags,
    });
  });

  it("initialise le hook correctement après le chargement et expose les handlers attendus", async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.actionHandlers).toBeDefined();
    });

    expect(typeof result.current.actionHandlers.onToggleRead).toBe("function");
    expect(typeof result.current.actionHandlers.onToggleStar).toBe("function");
    expect(typeof result.current.actionHandlers.onToggleProcessed).toBe("function");
    expect(typeof result.current.actionHandlers.onArchive).toBe("function");
    expect(typeof result.current.actionHandlers.onDelete).toBe("function");
    expect(typeof result.current.actionHandlers.onMarkAsSpam).toBe("function");
    expect(typeof result.current.actionHandlers.onUpdateTags).toBe("function");
    expect(typeof result.current.optimisticUpdateThread).toBe("function");
    expect(typeof result.current.optimisticRemoveThread).toBe("function");
    expect(mockUseEmailThreadActions).toHaveBeenCalledTimes(1);
  });

  it("optimisticUpdateThread met à jour uniquement le thread ciblé avec les valeurs métier réelles", () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.optimisticUpdateThread("t1", { unread_count: 0, tags: ["done"] });
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    const updater = setThreads.mock.calls[0][0] as (prev: typeof THREADS) => typeof THREADS;
    const next = updater(THREADS);

    expect(next).toEqual([
      {
        id: "t1",
        unread_count: 0,
        priority: null,
        is_processed: false,
        tags: ["done"],
        subject: "First",
      },
      THREADS[1],
    ]);
    expect(setSelectedThreads).not.toHaveBeenCalled();
  });

  it("optimisticRemoveThread retire le thread et le désélectionne", () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.optimisticRemoveThread("t1");
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    expect(setSelectedThreads).toHaveBeenCalledTimes(1);

    const threadsUpdater = setThreads.mock.calls[0][0] as (prev: typeof THREADS) => typeof THREADS;
    const nextThreads = threadsUpdater(THREADS);
    expect(nextThreads).toEqual([THREADS[1]]);

    const selectedUpdater = setSelectedThreads.mock.calls[0][0] as (prev: Set<string>) => Set<string>;
    const nextSelected = selectedUpdater(new Set(["t1", "t2"]));
    expect(Array.from(nextSelected)).toEqual(["t2"]);
  });

  it("onToggleRead marque comme lu et appelle markAsRead avec read=true quand isUnread=true", async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onToggleRead("t1", true);
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    const updater = setThreads.mock.calls[0][0] as (prev: typeof THREADS) => typeof THREADS;
    const next = updater(THREADS);
    expect(next[0].unread_count).toBe(0);
    expect(next[1]).toEqual(THREADS[1]);
    expect(mockMarkAsRead).toHaveBeenCalledWith({ threadId: "t1", read: true });
  });

  it("onToggleStar ajoute la priorité high quand le thread n'est pas étoilé", async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onToggleStar("t1", false);
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    const updater = setThreads.mock.calls[0][0] as (prev: typeof THREADS) => typeof THREADS;
    const next = updater(THREADS);
    expect(next[0].priority).toBe("high");
    expect(mockToggleStar).toHaveBeenCalledWith({ threadId: "t1", starred: true });
  });

  it("onToggleProcessed active le statut traité et remet unread_count à 0", async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onToggleProcessed("t1", false);
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    const updater = setThreads.mock.calls[0][0] as (prev: typeof THREADS) => typeof THREADS;
    const next = updater(THREADS);
    expect(next[0].is_processed).toBe(true);
    expect(next[0].unread_count).toBe(0);
    expect(mockMarkAsProcessed).toHaveBeenCalledWith({ threadId: "t1", processed: true });
  });

  it("onArchive retire le thread et appelle archiveThread avec archived=true", async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onArchive("t1");
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    expect(setSelectedThreads).toHaveBeenCalledTimes(1);

    const updater = setThreads.mock.calls[0][0] as (prev: typeof THREADS) => typeof THREADS;
    expect(updater(THREADS)).toEqual([THREADS[1]]);
    expect(mockArchiveThread).toHaveBeenCalledWith({ threadId: "t1", archived: true });
  });

  it("onDelete retire le thread et appelle deleteThread", async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onDelete("t1");
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    expect(setSelectedThreads).toHaveBeenCalledTimes(1);
    const updater = setThreads.mock.calls[0][0] as (prev: typeof THREADS) => typeof THREADS;
    expect(updater(THREADS)).toEqual([THREADS[1]]);
    expect(mockDeleteThread).toHaveBeenCalledWith({ threadId: "t1" });
  });

  it("onMarkAsSpam retire le thread et appelle markAsSpam avec isSpam=true", async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onMarkAsSpam("t1");
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    expect(setSelectedThreads).toHaveBeenCalledTimes(1);
    const updater = setThreads.mock.calls[0][0] as (prev: typeof THREADS) => typeof THREADS;
    expect(updater(THREADS)).toEqual([THREADS[1]]);
    expect(mockMarkAsSpam).toHaveBeenCalledWith({ threadId: "t1", isSpam: true });
  });

  it("onUpdateTags remplace les tags et appelle updateTags avec les valeurs exactes", async () => {
    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.actionHandlers.onUpdateTags("t1", ["clients", "followup"]);
    });

    expect(setThreads).toHaveBeenCalledTimes(1);
    const updater = setThreads.mock.calls[0][0] as (prev: typeof THREADS) => typeof THREADS;
    const next = updater(THREADS);
    expect(next[0].tags).toEqual(["clients", "followup"]);
    expect(mockUpdateTags).toHaveBeenCalledWith({ threadId: "t1", tags: ["clients", "followup"] });
  });

  it("propage une erreur si une action échoue", async () => {
    mockMarkAsRead.mockImplementationOnce(() => {
      throw new Error("x");
    });

    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () =>
        useEmailListPanelActionHandlers({
          setThreads,
          setSelectedThreads,
        }),
      { wrapper: createWrapper() },
    );

    await expect(
      act(async () => {
        result.current.actionHandlers.onToggleRead("t1", true);
      }),
    ).rejects.toThrow("x");

    expect(setThreads).toHaveBeenCalledTimes(1);
    const updater = setThreads.mock.calls[0][0] as (prev: typeof THREADS) => typeof THREADS;
    const next = updater(THREADS);
    expect(next[0].unread_count).toBe(0);
  });

  it("surfaced error state when dependency hook fails to initialize", async () => {
    mockUseEmailThreadActions.mockImplementationOnce(() => {
      throw new Error("x");
    });

    const setThreads = vi.fn();
    const setSelectedThreads = vi.fn();

    const { result } = renderHook(
      () => {
        try {
          return {
            isLoading: false,
            isError: false,
            value: useEmailListPanelActionHandlers({
              setThreads,
              setSelectedThreads,
            }),
          };
        } catch {
          return {
            isLoading: false,
            isError: true,
            value: null,
          };
        }
      },
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.value).toBeNull();
  });
});