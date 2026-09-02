import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmailInbox } from "./EmailInbox";

const {
  THREADS,
  ENRICHED_DATA,
  AUTH_STATE,
  FILTERS_STATE,
  ACCOUNT_IDS_STATE,
  mockFrom,
  mockRpc,
  mockHandleError,
  mockTriggerRefresh,
  mockToastSuccess,
  mockToastError,
  mockOnThreadSelect,
  mockOnComposeNew,
  mockUseInView,
  mockArchiveThread,
  mockDeleteThread,
  mockMarkAsRead,
  mockMarkAsUnread,
  mockToggleStar,
  mockBulkArchive,
  mockBulkDelete,
  mockBulkMarkAsRead,
} = vi.hoisted(() => {
  const THREADS = [
    {
      id: "t1",
      subject: "Welcome thread",
      last_message_date: "2024-02-10T12:00:00.000Z",
      updated_at: "2024-02-10T12:00:00.000Z",
      is_archived: false,
      is_spam: false,
      is_deleted: false,
      user_email_account_id: "acc-1",
    },
    {
      id: "t2",
      subject: "Follow up",
      last_message_date: "2024-02-09T12:00:00.000Z",
      updated_at: "2024-02-09T12:00:00.000Z",
      is_archived: false,
      is_spam: false,
      is_deleted: false,
      user_email_account_id: "acc-1",
    },
  ];

  const ENRICHED_DATA = {
    t1: { unread_count: 2 },
    t2: { unread_count: 0 },
  };

  const AUTH_STATE = {
    user: { id: "user-1", email: "u@test.io" },
    session: { user: { id: "user-1" } },
    isLoading: false,
  };

  const FILTERS_STATE = {
    filters: {
      search: "",
      category: "",
      priority: "",
      unreadOnly: false,
      unprocessedOnly: false,
      mailbox: "inbox",
      etablissementId: "",
      groupeId: "",
      partenaireId: "",
    },
    updateFilter: vi.fn(),
    resetFilters: vi.fn(),
  };

  const ACCOUNT_IDS_STATE = {
    accountIds: ["acc-1"],
    hasAccounts: true,
  };

  return {
    THREADS,
    ENRICHED_DATA,
    AUTH_STATE,
    FILTERS_STATE,
    ACCOUNT_IDS_STATE,
    mockFrom: vi.fn(),
    mockRpc: vi.fn(),
    mockHandleError: vi.fn(),
    mockTriggerRefresh: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockOnThreadSelect: vi.fn(),
    mockOnComposeNew: vi.fn(),
    mockUseInView: vi.fn(),
    mockArchiveThread: vi.fn(),
    mockDeleteThread: vi.fn(),
    mockMarkAsRead: vi.fn(),
    mockMarkAsUnread: vi.fn(),
    mockToggleStar: vi.fn(),
    mockBulkArchive: vi.fn(),
    mockBulkDelete: vi.fn(),
    mockBulkMarkAsRead: vi.fn(),
  };
});

function createThenableBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };

  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/safeStorage", () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("./inbox/threadQuery", () => ({
  EMAIL_THREAD_SELECT: "id,subject,last_message_date,updated_at",
  applyThreadFilters: vi.fn((query) => query),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  Mail: () => <span data-testid="icon-mail" />,
  Plus: () => <span data-testid="icon-plus" />,
  ArrowUp: () => <span data-testid="icon-arrow-up" />,
  Filter: () => <span data-testid="icon-filter" />,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: vi.fn(),
}));

vi.mock("react-intersection-observer", () => ({
  useInView: () => mockUseInView(),
}));

vi.mock("./EmailInboxToolbarConsolidated", () => ({
  EmailInboxToolbarConsolidated: () => <div data-testid="toolbar" />,
}));

vi.mock("./MobileEmailFilters", () => ({
  MobileEmailFilters: () => <div data-testid="mobile-filters" />,
}));

vi.mock("./MobileEmailQuickFilters", () => ({
  MobileEmailQuickFilters: () => <div data-testid="mobile-quick-filters" />,
}));

vi.mock("./InfiniteScrollLoader", () => ({
  InfiniteScrollLoader: () => <div data-testid="infinite-loader" />,
}));

vi.mock("./EmailSyncProgressBar", () => ({
  EmailSyncProgressBar: () => <div data-testid="sync-progress" />,
}));

vi.mock("./EmailListSkeleton", () => ({
  EmailListSkeleton: () => <div data-testid="email-list-skeleton">loading emails</div>,
}));

vi.mock("./EmailListEmptyState", () => ({
  EmailListEmptyState: () => <div data-testid="empty-state">no emails</div>,
}));

vi.mock("./BulkActionsBar", () => ({
  BulkActionsBar: () => <div data-testid="bulk-actions" />,
}));

vi.mock("./EmailInboxListView", () => ({
  EmailInboxListView: ({ threads }: { threads: Array<{ id: string; subject?: string }> }) => (
    <div data-testid="list-view">
      <div data-testid="thread-count">{threads.length}</div>
      {threads.map((thread) => (
        <div key={thread.id}>{thread.subject}</div>
      ))}
    </div>
  ),
}));

vi.mock("@/hooks/email/useEmailFilters", () => ({
  useEmailFilters: () => FILTERS_STATE,
}));

vi.mock("@/hooks/shared/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock("@/hooks/email/useEmailRefresh", () => ({
  useEmailRefresh: () => ({
    triggerRefresh: mockTriggerRefresh,
  }),
}));

vi.mock("@/hooks/shared/useErrorHandler", () => ({
  useErrorHandler: () => ({
    handleError: mockHandleError,
  }),
}));

vi.mock("@/hooks/email/useThreadsEnrichedData", () => ({
  useThreadsEnrichedData: () => ({
    data: ENRICHED_DATA,
  }),
}));

vi.mock("./inbox/useEmailInboxActionHandlers", () => ({
  useEmailInboxActionHandlers: () => ({
    actionHandlers: {
      archiveThread: mockArchiveThread,
      deleteThread: mockDeleteThread,
      markAsRead: mockMarkAsRead,
      markAsUnread: mockMarkAsUnread,
      toggleStar: mockToggleStar,
    },
    optimisticUpdateThread: vi.fn(),
    optimisticRemoveThread: vi.fn(),
  }),
}));

vi.mock("./inbox/useEmailBulkActionHandlers", () => ({
  useEmailBulkActionHandlers: () => ({
    handleBulkArchive: mockBulkArchive,
    handleBulkDelete: mockBulkDelete,
    handleBulkMarkAsRead: mockBulkMarkAsRead,
  }),
}));

vi.mock("@/components/mobile/MobileDrawer", () => ({
  MobileDrawer: ({ children }: { children?: React.ReactNode }) => <div data-testid="mobile-drawer">{children}</div>,
}));

vi.mock("@/hooks/shared/useUserEmailAccountIds", () => ({
  useUserEmailAccountIds: () => ACCOUNT_IDS_STATE,
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

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("EmailInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUseInView.mockReturnValue({ ref: vi.fn(), inView: false });
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockFrom.mockImplementation(() => createThenableBuilder({ data: THREADS, error: null }));
  });

  it("affiche la liste des threads chargés", async () => {
    render(<EmailInbox onThreadSelect={mockOnThreadSelect} onComposeNew={mockOnComposeNew} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId("list-view")).toBeInTheDocument();
    });

    expect(screen.getByTestId("thread-count").textContent).toBe("2");
    expect(screen.getByText("Welcome thread")).toBeInTheDocument();
    expect(screen.getByText("Follow up")).toBeInTheDocument();
    expect(mockFrom).toHaveBeenCalledWith("email_threads");
  });

  it("applique les filtres métier de base sur la requête supabase", async () => {
    const builder = createThenableBuilder({ data: THREADS, error: null });
    mockFrom.mockImplementation(() => builder);

    render(<EmailInbox onThreadSelect={mockOnThreadSelect} accountId="acc-1" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId("list-view")).toBeInTheDocument();
    });

    expect(builder.eq).toHaveBeenCalledWith("is_archived", false);
    expect(builder.eq).toHaveBeenCalledWith("is_spam", false);
    expect(builder.eq).toHaveBeenCalledWith("is_deleted", false);
    expect(builder.eq).toHaveBeenCalledWith("user_email_account_id", "acc-1");
    expect(builder.order).toHaveBeenCalledWith("last_message_date", { ascending: false });
    expect(builder.range).toHaveBeenCalledWith(0, 19);
  });

  it("gère une erreur de chargement sans réseau réel", async () => {
    const failingBuilder = createThenableBuilder({
      data: null,
      error: { message: "x" },
    });

    failingBuilder.then = (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.reject(new Error("x")).then(onFulfilled, onRejected);
    failingBuilder.catch = (onRejected: (reason: unknown) => unknown) =>
      Promise.reject(new Error("x")).catch(onRejected);

    mockFrom.mockImplementation(() => failingBuilder);

    render(<EmailInbox onThreadSelect={mockOnThreadSelect} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockHandleError).toHaveBeenCalled();
    });

    expect(mockHandleError.mock.calls[0]?.[1]).toBe("Chargement des emails");
  });
});