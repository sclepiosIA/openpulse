/* @vitest-environment jsdom */
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEmailBulkActionHandlers } from "./useEmailBulkActionHandlers";
import { toast } from "sonner";

const {
  THREADS,
  PROFILE_ROW,
  mockFrom,
  resetSupabaseMocks,
  setTableResult,
  builders,
} = vi.hoisted(() => {
  const THREADS = [
    { id: "t1", unread_count: 2, is_processed: false },
    { id: "t2", unread_count: 1, is_processed: false },
    { id: "t3", unread_count: 0, is_processed: false },
  ];

  const PROFILE_ROW = { id: "u1" };

  type ResultState = { data: unknown; error: unknown };

  const createBuilder = () => {
    const state: {
      table: string;
      result: ResultState;
      maybeSingleResult: ResultState;
    } = {
      table: "",
      result: { data: [], error: null },
      maybeSingleResult: { data: null, error: null },
    };

    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      single: vi.fn(async () => state.result),
      maybeSingle: vi.fn(async () => state.maybeSingleResult),
      then: (
        onFulfilled?: (value: ResultState) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(state.result).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(state.result).catch(onRejected),
      __state: state,
    };

    return chain;
  };

  const builders = {
    email_threads: createBuilder(),
    email_messages: createBuilder(),
    profiles: createBuilder(),
    fallback: createBuilder(),
  };

  const resetBuilder = (builder: ReturnType<typeof createBuilder>, table: string) => {
    builder.__state.table = table;
    builder.__state.result = { data: [], error: null };
    builder.__state.maybeSingleResult = { data: null, error: null };
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
  };

  const resetSupabaseMocks = () => {
    resetBuilder(builders.email_threads, "email_threads");
    resetBuilder(builders.email_messages, "email_messages");
    resetBuilder(builders.profiles, "profiles");
    resetBuilder(builders.fallback, "fallback");
    builders.profiles.__state.result = { data: PROFILE_ROW, error: null };
    builders.profiles.__state.maybeSingleResult = { data: PROFILE_ROW, error: null };
    mockFrom.mockClear();
  };

  const setTableResult = (
    table: "email_threads" | "email_messages" | "profiles",
    result: ResultState,
  ) => {
    builders[table].__state.result = result;
  };

  const mockFrom = vi.fn((table: string) => {
    if (table === "email_threads") return builders.email_threads;
    if (table === "email_messages") return builders.email_messages;
    if (table === "profiles") return builders.profiles;
    return builders.fallback;
  });

  resetSupabaseMocks();

  return {
    THREADS,
    PROFILE_ROW,
    mockFrom,
    resetSupabaseMocks,
    setTableResult,
    builders,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useEmailBulkActionHandlers", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    return { wrapper, queryClient, invalidateSpy };
  };

  const setup = (overrides?: {
    user?: { id: string } | null;
    selectedThreads?: Set<string>;
    confirmResult?: boolean;
  }) => {
    resetSupabaseMocks();
    vi.clearAllMocks();

    const { wrapper, queryClient, invalidateSpy } = createWrapper();

    let threads = THREADS.map((t) => ({ ...t }));
    let selected = overrides?.selectedThreads ?? new Set<string>(["t1", "t2"]);

    const setThreads = vi.fn((updater: React.SetStateAction<typeof threads>) => {
      threads = typeof updater === "function" ? updater(threads) : updater;
    });

    const setSelectedThreads = vi.fn((next: Set<string>) => {
      selected = next;
    });

    const optimisticRemoveThread = vi.fn((threadId: string) => {
      threads = threads.filter((t) => t.id !== threadId);
    });

    const fetchThreads = vi.fn(async () => {});
    const handleError = vi.fn();

    vi.stubGlobal("confirm", vi.fn(() => overrides?.confirmResult ?? true));

    const hook = renderHook(
      () =>
        useEmailBulkActionHandlers({
          user: overrides?.user === undefined ? ({ id: "u1" } as { id: string }) : overrides.user,
          queryClient,
          selectedThreads: selected,
          setSelectedThreads,
          setThreads,
          optimisticRemoveThread,
          fetchThreads,
          handleError,
        }),
      { wrapper },
    );

    return {
      hook,
      invalidateSpy,
      getThreads: () => threads,
      getSelected: () => selected,
      setThreads,
      setSelectedThreads,
      optimisticRemoveThread,
      fetchThreads,
      handleError,
      confirmMock: globalThis.confirm as ReturnType<typeof vi.fn>,
    };
  };

  it("expose les handlers attendus après chargement initial", async () => {
    const ctx = setup();

    await waitFor(() => {
      expect(ctx.hook.result.current.handleArchiveSelected).toBeTypeOf("function");
      expect(ctx.hook.result.current.handleArchiveThread).toBeTypeOf("function");
      expect(ctx.hook.result.current.handleMarkAsSpamSelected).toBeTypeOf("function");
      expect(ctx.hook.result.current.handleMarkAsReadSelected).toBeTypeOf("function");
      expect(ctx.hook.result.current.handleMarkAsProcessedSelected).toBeTypeOf("function");
      expect(ctx.hook.result.current.handleDeleteSelected).toBeTypeOf("function");
      expect(ctx.hook.result.current.handleDeleteThread).toBeTypeOf("function");
    });
  });

  it("archive les threads sélectionnés avec mise à jour optimiste et succès", async () => {
    const ctx = setup();

    await act(async () => {
      await ctx.hook.result.current.handleArchiveSelected();
    });

    expect(ctx.getThreads()).toEqual([{ id: "t3", unread_count: 0, is_processed: false }]);
    expect(ctx.getSelected()).toEqual(new Set());
    expect(builders.email_threads.update).toHaveBeenCalledWith({ is_archived: true });
    expect(builders.email_threads.in).toHaveBeenCalledWith("id", ["t1", "t2"]);
    expect(toast.success).toHaveBeenCalledWith("2 email(s) archivé(s)");
    expect(ctx.handleError).not.toHaveBeenCalled();
    expect(ctx.fetchThreads).not.toHaveBeenCalled();
  });

  it("gère l'erreur lors de l'archivage sélectionné", async () => {
    const ctx = setup();
    setTableResult("email_threads", { data: null, error: { message: "x" } });

    await act(async () => {
      await ctx.hook.result.current.handleArchiveSelected();
    });

    expect(ctx.handleError).toHaveBeenCalledWith({ message: "x" }, "EmailInbox.handleArchiveSelected");
    expect(ctx.fetchThreads).toHaveBeenCalledWith(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("archive un thread unique avec retrait optimiste", async () => {
    const ctx = setup();

    await act(async () => {
      await ctx.hook.result.current.handleArchiveThread("t2");
    });

    expect(ctx.optimisticRemoveThread).toHaveBeenCalledWith("t2");
    expect(ctx.getThreads()).toEqual([
      { id: "t1", unread_count: 2, is_processed: false },
      { id: "t3", unread_count: 0, is_processed: false },
    ]);
    expect(builders.email_threads.update).toHaveBeenCalledWith({ is_archived: true });
    expect(builders.email_threads.eq).toHaveBeenCalledWith("id", "t2");
    expect(toast.success).toHaveBeenCalledWith("Email archivé");
  });

  it("marque les threads sélectionnés comme spam", async () => {
    const ctx = setup();

    await act(async () => {
      await ctx.hook.result.current.handleMarkAsSpamSelected();
    });

    expect(ctx.getThreads()).toEqual([{ id: "t3", unread_count: 0, is_processed: false }]);
    expect(builders.email_threads.update).toHaveBeenCalledWith({ is_spam: true });
    expect(builders.email_threads.in).toHaveBeenCalledWith("id", ["t1", "t2"]);
    expect(toast.success).toHaveBeenCalledWith("2 email(s) marqué(s) comme spam");
  });

  it("marque les threads sélectionnés comme lus et invalide email-counts", async () => {
    const ctx = setup();

    await act(async () => {
      await ctx.hook.result.current.handleMarkAsReadSelected();
    });

    expect(ctx.getThreads()).toEqual([
      { id: "t1", unread_count: 0, is_processed: false },
      { id: "t2", unread_count: 0, is_processed: false },
      { id: "t3", unread_count: 0, is_processed: false },
    ]);
    expect(builders.email_threads.update).toHaveBeenCalledWith({ unread_count: 0 });
    expect(builders.email_threads.in).toHaveBeenCalledWith("id", ["t1", "t2"]);
    expect(builders.email_messages.update).toHaveBeenCalledWith({ is_read: true });
    expect(builders.email_messages.in).toHaveBeenCalledWith("thread_id", ["t1", "t2"]);
    expect(builders.email_messages.eq).toHaveBeenCalledWith("is_read", false);
    expect(toast.success).toHaveBeenCalledWith("2 email(s) marqué(s) comme lu(s)");
    expect(ctx.invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-counts"] });
  });

  it("gère l'erreur lors du marquage comme lu", async () => {
    const ctx = setup();
    setTableResult("email_threads", { data: null, error: { message: "x" } });

    await act(async () => {
      await ctx.hook.result.current.handleMarkAsReadSelected();
    });

    expect(ctx.handleError).toHaveBeenCalledWith({ message: "x" }, "EmailInbox.handleMarkAsReadSelected");
    expect(ctx.fetchThreads).toHaveBeenCalledWith(true);
    expect(ctx.invalidateSpy).not.toHaveBeenCalled();
  });

  it("marque les threads sélectionnés comme traités avec processed_by issu du profil", async () => {
    const ctx = setup({ user: { id: "u1" } });

    await act(async () => {
      await ctx.hook.result.current.handleMarkAsProcessedSelected();
    });

    expect(builders.profiles.select).toHaveBeenCalledWith("id");
    expect(builders.profiles.eq).toHaveBeenCalledWith("id", "u1");

    const updateArg = builders.email_threads.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.is_processed).toBe(true);
    expect(updateArg.processed_by).toBe("u1");
    expect(updateArg.unread_count).toBe(0);
    expect(typeof updateArg.processed_at).toBe("string");

    expect(builders.email_threads.in).toHaveBeenCalledWith("id", ["t1", "t2"]);
    expect(builders.email_messages.update).toHaveBeenCalledWith({ is_read: true });
    expect(builders.email_messages.in).toHaveBeenCalledWith("thread_id", ["t1", "t2"]);
    expect(builders.email_messages.eq).toHaveBeenCalledWith("is_read", false);
    expect(ctx.getThreads()).toEqual([
      { id: "t1", unread_count: 0, is_processed: true },
      { id: "t2", unread_count: 0, is_processed: true },
      { id: "t3", unread_count: 0, is_processed: false },
    ]);
    expect(toast.success).toHaveBeenCalledWith("2 email(s) marqué(s) comme traité(s)");
    expect(ctx.invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-counts"] });
  });

  it("gère l'erreur lors du marquage comme traité", async () => {
    const ctx = setup({ user: { id: "u1" } });
    setTableResult("email_threads", { data: null, error: { message: "x" } });

    await act(async () => {
      await ctx.hook.result.current.handleMarkAsProcessedSelected();
    });

    expect(ctx.handleError).toHaveBeenCalledWith({ message: "x" }, "EmailInbox.handleMarkAsProcessedSelected");
    expect(ctx.fetchThreads).toHaveBeenCalledWith(true);
  });

  it("supprime les threads sélectionnés après confirmation", async () => {
    const ctx = setup({ confirmResult: true });

    await act(async () => {
      await ctx.hook.result.current.handleDeleteSelected();
    });

    expect(ctx.confirmMock).toHaveBeenCalledWith(
      "Êtes-vous sûr de vouloir supprimer 2 email(s) ? Cette action peut être annulée depuis la corbeille.",
    );
    expect(ctx.getThreads()).toEqual([{ id: "t3", unread_count: 0, is_processed: false }]);
    expect(builders.email_threads.update).toHaveBeenCalledWith({ is_deleted: true });
    expect(builders.email_threads.in).toHaveBeenCalledWith("id", ["t1", "t2"]);
    expect(toast.success).toHaveBeenCalledWith("2 email(s) supprimé(s)");
  });

  it("ne supprime rien si la confirmation est refusée", async () => {
    const ctx = setup({ confirmResult: false });

    await act(async () => {
      await ctx.hook.result.current.handleDeleteSelected();
    });

    expect(ctx.getThreads()).toEqual(THREADS);
    expect(ctx.setThreads).not.toHaveBeenCalled();
    expect(ctx.setSelectedThreads).not.toHaveBeenCalled();
    expect(builders.email_threads.update).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("supprime un thread unique avec retrait optimiste", async () => {
    const ctx = setup();

    await act(async () => {
      await ctx.hook.result.current.handleDeleteThread("t1");
    });

    expect(ctx.optimisticRemoveThread).toHaveBeenCalledWith("t1");
    expect(ctx.getThreads()).toEqual([
      { id: "t2", unread_count: 1, is_processed: false },
      { id: "t3", unread_count: 0, is_processed: false },
    ]);
    expect(builders.email_threads.update).toHaveBeenCalledWith({ is_deleted: true });
    expect(builders.email_threads.eq).toHaveBeenCalledWith("id", "t1");
    expect(toast.success).toHaveBeenCalledWith("Email supprimé");
  });

  it("gère l'erreur lors de la suppression d'un thread unique", async () => {
    const ctx = setup();
    setTableResult("email_threads", { data: null, error: { message: "x" } });

    await act(async () => {
      await ctx.hook.result.current.handleDeleteThread("t1");
    });

    expect(ctx.optimisticRemoveThread).toHaveBeenCalledWith("t1");
    expect(ctx.handleError).toHaveBeenCalledWith({ message: "x" }, "EmailInbox.handleDeleteThread");
    expect(ctx.fetchThreads).toHaveBeenCalledWith(true);
  });
});